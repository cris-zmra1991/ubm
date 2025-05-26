
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

// TODO: SQL - CREATE TABLE para Plan de Cuentas (chart_of_accounts)
// CREATE TABLE chart_of_accounts (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   code VARCHAR(50) NOT NULL UNIQUE,
//   name VARCHAR(255) NOT NULL,
//   type ENUM('Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Gasto') NOT NULL,
//   balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// TODO: SQL - CREATE TABLE para Asientos Contables (journal_entries)
// CREATE TABLE journal_entries (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   date DATE NOT NULL,
//   entryNumber VARCHAR(100) NOT NULL UNIQUE,
//   description TEXT NOT NULL,
//   debitAccountCode VARCHAR(50) NOT NULL,
//   creditAccountCode VARCHAR(50) NOT NULL,
//   amount DECIMAL(15, 2) NOT NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (debitAccountCode) REFERENCES chart_of_accounts(code),
//   FOREIGN KEY (creditAccountCode) REFERENCES chart_of_accounts(code)
// );
// -- Considerar añadir un índice a `date` y `entryNumber`.


export const AccountSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'El código de cuenta es requerido.'),
  name: z.string().min(1, 'El nombre de cuenta es requerido.'),
  type: z.enum(["Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto"], {
    errorMap: () => ({ message: 'Selecciona un tipo de cuenta válido.' }),
  }),
  balance: z.coerce.number().default(0),
});
export type AccountFormInput = z.infer<typeof AccountSchema>;

export const JournalEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'La fecha es requerida.'), // Validar formato de fecha si es necesario
  entryNumber: z.string().min(1, 'El número de asiento es requerido.'),
  description: z.string().min(1, 'La descripción es requerida.'),
  debitAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de débito.'),
  creditAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de crédito.'),
  amount: z.coerce.number().positive('El monto debe ser positivo.'),
});
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;

export interface AccountingActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any; 
  data?: T & { id: string };
}

// --- Acciones para Plan de Cuentas ---
export async function addAccount(
  data: AccountFormInput
): Promise<AccountingActionResponse<AccountFormInput>> {
  const validatedFields = AccountSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in addAccount.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { code, name, type, balance } = validatedFields.data;
  try {
    // TODO: SQL - Insertar cuenta en MySQL
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO chart_of_accounts (code, name, type, balance) VALUES (?, ?, ?, ?)',
      [code, name, type, balance]
    );
    if (result.affectedRows > 0) {
      const newAccountId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Cuenta añadida exitosamente.', data: { ...validatedFields.data, id: newAccountId } };
    } else {
      return { success: false, message: 'No se pudo añadir la cuenta.' };
    }
  } catch (error: any) {
    console.error('Error al añadir cuenta (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El código de cuenta ya existe.', errors: { code: ['Este código de cuenta ya está registrado.'] } };
    }
    return { success: false, message: 'Error al añadir cuenta.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function updateAccount(
  data: AccountFormInput
): Promise<AccountingActionResponse<AccountFormInput>> {
   if (!data.id) return { success: false, message: 'ID de cuenta requerido.' };
  const validatedFields = AccountSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in updateAccount.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { id, code, name, type } = validatedFields.data;
  // El saldo no se actualiza directamente aquí, se actualiza mediante asientos.
  try {
    // TODO: SQL - Actualizar cuenta en MySQL (sin el saldo)
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE chart_of_accounts SET code = ?, name = ?, type = ? WHERE id = ?',
      [code, name, type, id]
    );
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      // Devolver los datos con el saldo actual de la DB
      const [updatedRows] = await pool.query<RowDataPacket[]>('SELECT * FROM chart_of_accounts WHERE id = ?', [id]);
      if (updatedRows.length > 0) {
          const accountData = { ...updatedRows[0], id: updatedRows[0].id.toString(), balance: parseFloat(updatedRows[0].balance) } as AccountFormInput & {id: string};
          return { success: true, message: 'Cuenta actualizada.', data: accountData };
      }
      return { success: false, message: 'Cuenta actualizada pero no se pudo recargar.' };
    } else {
      return { success: false, message: 'Cuenta no encontrada o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar cuenta (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El código de cuenta ya existe para otra cuenta.', errors: { code: ['Este código de cuenta ya está registrado para otra cuenta.'] } };
    }
    return { success: false, message: 'Error al actualizar cuenta.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteAccount(accountId: string): Promise<AccountingActionResponse<null>> {
  if (!pool) {
    console.error('Error: Connection pool not available in deleteAccount.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  try {
    // TODO: SQL - Lógica para eliminar cuenta en MySQL
    // Considerar validaciones: no eliminar si tiene asientos contables asociados.
    // Por ahora, solo eliminamos directamente.
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM chart_of_accounts WHERE id = ?', [accountId]);
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Cuenta eliminada.' };
    } else {
      return { success: false, message: 'Cuenta no encontrada para eliminar.' };
    }
  } catch (error: any) {
    console.error('Error al eliminar cuenta (MySQL):', error);
     // Si hay una restricción de FK (ej. por asientos asociados), MySQL arrojará un error (ej. ER_ROW_IS_REFERENCED_2)
    if (error.errno === 1451) { // ER_ROW_IS_REFERENCED_2
        return { success: false, message: 'No se puede eliminar la cuenta porque tiene asientos contables asociados.' };
    }
    return { success: false, message: 'Error al eliminar cuenta.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getAccounts(): Promise<AccountFormInput[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getAccounts.');
    return [];
  }
  try {
    // TODO: SQL - Obtener cuentas de MySQL
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, code, name, type, balance FROM chart_of_accounts ORDER BY code ASC');
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
        balance: parseFloat(row.balance)
    })) as AccountFormInput[];
  } catch (error) {
    console.error('Error al obtener cuentas (MySQL):', error);
    return [];
  }
}

// --- Acciones para Asientos Contables ---
export async function addJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  const validatedFields = JournalEntrySchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in addJournalEntry.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { date, entryNumber, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // TODO: SQL - Validar que las cuentas de débito/crédito existan
    const [debitAccount] = await connection.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE code = ?', [debitAccountCode]);
    const [creditAccount] = await connection.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE code = ?', [creditAccountCode]);

    if (debitAccount.length === 0) {
      await connection.rollback();
      return { success: false, message: 'La cuenta de débito no existe.', errors: { debitAccountCode: ['Código de cuenta de débito inválido.']}};
    }
    if (creditAccount.length === 0) {
      await connection.rollback();
      return { success: false, message: 'La cuenta de crédito no existe.', errors: { creditAccountCode: ['Código de cuenta de crédito inválido.']}};
    }
    if (debitAccountCode === creditAccountCode) {
      await connection.rollback();
      return { success: false, message: 'Las cuentas de débito y crédito no pueden ser la misma.', errors: { creditAccountCode: ['Selecciona una cuenta diferente.']}};
    }


    // TODO: SQL - Insertar asiento en MySQL
    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO journal_entries (date, entryNumber, description, debitAccountCode, creditAccountCode, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, amount]
    );

    // TODO: SQL - Actualizar saldos de cuentas afectadas (transacción)
    // Esta es una simplificación. La lógica real depende de si la cuenta es de Activo, Pasivo, Ingreso, Gasto, etc.
    // Por ejemplo, un Activo aumenta con débito, un Pasivo aumenta con crédito.
    // Necesitarías obtener el tipo de cuenta para aplicar la lógica correcta.
    // Aquí asumimos una lógica simple: débito incrementa, crédito disminuye para la cuenta de débito
    // y viceversa para la cuenta de crédito. ESTO ES UNA SIMPLIFICACIÓN.
    await connection.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [amount, debitAccountCode]);
    await connection.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [amount, creditAccountCode]);
    // ¡RECUERDA! La lógica de arriba para actualizar saldos es muy simplificada y probablemente incorrecta para todos los tipos de cuenta.
    // Deberás implementar la lógica contable correcta según el tipo de cuenta (Activo, Pasivo, etc.).

    await connection.commit();
    
    if (result.affectedRows > 0) {
      const newEntryId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Asiento contable añadido.', data: { ...validatedFields.data, id: newEntryId } };
    } else {
      // Esto no debería ocurrir si la inserción no lanzó error
      return { success: false, message: 'No se pudo añadir el asiento.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir asiento (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El número de asiento ya existe.', errors: { entryNumber: ['Este número de asiento ya está registrado.'] } };
    }
    return { success: false, message: 'Error al añadir asiento.', errors: { general: ['Error del servidor.'] } };
  } finally {
    if (connection) connection.release();
  }
}

export async function updateJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  if (!data.id) return { success: false, message: 'ID de asiento requerido.' };
  const validatedFields = JournalEntrySchema.safeParse(data);
   if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in updateJournalEntry.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  
  // TODO: SQL - Actualizar asiento en MySQL
  // Esto es complejo porque implica revertir los saldos del asiento original y aplicar los nuevos.
  // Por simplicidad, esta simulación solo actualiza los datos del asiento.
  // En una implementación real, necesitarías una transacción para:
  // 1. Obtener el asiento antiguo.
  // 2. Revertir el impacto del asiento antiguo en los saldos de las cuentas.
  // 3. Actualizar el asiento con los nuevos datos.
  // 4. Aplicar el impacto del nuevo asiento (con nuevos montos/cuentas) en los saldos.
  // 5. Commit o Rollback.

  const { id, date, entryNumber, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;
  
  try {
    // Validar cuentas como en addJournalEntry
    const [debitAccount] = await pool.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE code = ?', [debitAccountCode]);
    const [creditAccount] = await pool.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE code = ?', [creditAccountCode]);
    if (debitAccount.length === 0 || creditAccount.length === 0 || debitAccountCode === creditAccountCode) {
        return { success: false, message: 'Cuentas de débito/crédito inválidas.'};
    }

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE journal_entries SET date = ?, entryNumber = ?, description = ?, debitAccountCode = ?, creditAccountCode = ?, amount = ? WHERE id = ?',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, amount, id]
    );

    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        // NOTA: Los saldos de las cuentas NO se han recalculado aquí por simplicidad.
        return { success: true, message: 'Asiento actualizado (saldos no recalculados).', data: { ...validatedFields.data, id: id! } };
    } else {
        return { success: false, message: 'Asiento no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar asiento (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El número de asiento ya existe para otro asiento.', errors: { entryNumber: ['Este número de asiento ya está registrado para otro asiento.'] } };
    }
    return { success: false, message: 'Error al actualizar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteJournalEntry(entryId: string): Promise<AccountingActionResponse<null>> {
   if (!pool) {
    console.error('Error: Connection pool not available in deleteJournalEntry.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  // TODO: SQL - Eliminar asiento en MySQL
  // Similar a update, esto es complejo. Necesitarías revertir el impacto del asiento en los saldos.
  // Por simplicidad, esta simulación solo elimina el asiento.
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM journal_entries WHERE id = ?', [entryId]);
    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        // NOTA: Los saldos de las cuentas NO se han recalculado aquí por simplicidad.
        return { success: true, message: 'Asiento eliminado (saldos no recalculados).' };
    } else {
        return { success: false, message: 'Asiento no encontrado para eliminar.'};
    }
  } catch (error) {
    console.error('Error al eliminar asiento (MySQL):', error);
    return { success: false, message: 'Error al eliminar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getJournalEntries(): Promise<JournalEntryFormInput[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getJournalEntries.');
    return [];
  }
  try {
    // TODO: SQL - Obtener asientos de MySQL
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, entryNumber, description, debitAccountCode, creditAccountCode, amount FROM journal_entries ORDER BY date DESC, entryNumber DESC'
    );
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
        amount: parseFloat(row.amount)
    })) as JournalEntryFormInput[];
  } catch (error) {
    console.error('Error al obtener asientos (MySQL):', error);
    return [];
  }
}
