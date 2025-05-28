
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { AccountSchema, JournalEntrySchema } from '@/app/schemas/accounting.schemas';

export type AccountFormInput = z.infer<typeof AccountSchema>;
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;

// Tipo extendido para incluir el saldo acumulado y la información del padre
export interface AccountWithDetails extends AccountFormInput {
  id: string;
  parent_account_id?: string | null; // Para la UI, el ID de la cuenta padre
  rolledUpBalance?: number; // Saldo acumulado (directo + hijos)
  children?: AccountWithDetails[]; // Para construir la jerarquía
}


export interface AccountingActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any;
  data?: T & { id: string };
}

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

  const { code, name, type, balance, parentAccountId } = validatedFields.data;
  try {
    const parentIdValue = parentAccountId === "" || parentAccountId === "null" || parentAccountId === undefined ? null : parseInt(parentAccountId);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO chart_of_accounts (code, name, type, balance, parent_account_id) VALUES (?, ?, ?, ?, ?)',
      [code, name, type, balance, parentIdValue]
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
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: La cuenta padre seleccionada no existe.', errors: { parentAccountId: ['La cuenta padre seleccionada no es válida.']}};
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

  const { id, code, name, type, parentAccountId } = validatedFields.data;
  // El saldo (balance) no se actualiza directamente aquí, se actualiza mediante asientos.
  try {
    const parentIdValue = parentAccountId === "" || parentAccountId === "null" || parentAccountId === undefined  ? null : parseInt(parentAccountId);

    // Evitar que una cuenta sea su propio padre
    if (id === parentAccountId) {
        return { success: false, message: 'Una cuenta no puede ser su propia cuenta padre.', errors: { parentAccountId: ['Selecciona una cuenta padre diferente.'] } };
    }
    // TODO: Implementar validación para evitar ciclos (ej. A padre de B, B padre de A) si es necesario.

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE chart_of_accounts SET code = ?, name = ?, type = ?, parent_account_id = ? WHERE id = ?',
      [code, name, type, parentIdValue, id]
    );
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      const [updatedRows] = await pool.query<RowDataPacket[]>('SELECT *, parent_account_id as parentAccountId FROM chart_of_accounts WHERE id = ?', [id]);
      if (updatedRows.length > 0) {
          const accountData = { ...updatedRows[0], id: updatedRows[0].id.toString(), balance: parseFloat(updatedRows[0].balance), parentAccountId: updatedRows[0].parentAccountId?.toString() || null } as AccountFormInput & {id: string};
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
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: La cuenta padre seleccionada no existe.', errors: { parentAccountId: ['La cuenta padre seleccionada no es válida.']}};
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
    // Verificar si la cuenta tiene cuentas hijas
    const [childrenRows] = await pool.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE parent_account_id = ?', [accountId]);
    if (childrenRows.length > 0) {
      return { success: false, message: 'No se puede eliminar la cuenta porque tiene cuentas hijas asociadas. Primero elimine o reasigne las cuentas hijas.' };
    }

    const [result] = await pool.query<ResultSetHeader>('DELETE FROM chart_of_accounts WHERE id = ?', [accountId]);
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Cuenta eliminada.' };
    } else {
      return { success: false, message: 'Cuenta no encontrada para eliminar.' };
    }
  } catch (error: any) {
    console.error('Error al eliminar cuenta (MySQL):', error);
    if (error.errno === 1451) {
        return { success: false, message: 'No se puede eliminar la cuenta porque tiene asientos contables asociados.' };
    }
    return { success: false, message: 'Error al eliminar cuenta.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getAccounts(): Promise<AccountWithDetails[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getAccounts.');
    return [];
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, code, name, type, balance, parent_account_id FROM chart_of_accounts ORDER BY code ASC'
    );

    const accounts: AccountWithDetails[] = rows.map(row => ({
      id: row.id.toString(),
      code: row.code,
      name: row.name,
      type: row.type,
      balance: parseFloat(row.balance),
      parentAccountId: row.parent_account_id?.toString() || null,
      parent_account_id: row.parent_account_id?.toString() || null, // Para mapeo interno
      rolledUpBalance: parseFloat(row.balance), // Inicializar con balance directo
      children: [],
    }));

    // Construir jerarquía y calcular saldos acumulados
    const accountMap = new Map<string, AccountWithDetails>();
    accounts.forEach(acc => accountMap.set(acc.id, acc));

    const rootAccounts: AccountWithDetails[] = [];
    accounts.forEach(acc => {
      if (acc.parent_account_id && accountMap.has(acc.parent_account_id)) {
        const parent = accountMap.get(acc.parent_account_id)!;
        parent.children = parent.children || [];
        parent.children.push(acc);
      } else {
        rootAccounts.push(acc);
      }
    });

    function calculateRolledUpBalances(account: AccountWithDetails): number {
      let sum = account.balance; // Saldo directo de la cuenta
      if (account.children && account.children.length > 0) {
        for (const child of account.children) {
          sum += calculateRolledUpBalances(child);
        }
      }
      account.rolledUpBalance = sum;
      return sum;
    }

    rootAccounts.forEach(calculateRolledUpBalances);
    // Es posible que necesites aplanar la lista de nuevo si la UI no maneja la jerarquía directamente.
    // O devolver rootAccounts si la UI puede renderizar el árbol.
    // Por ahora, devolvemos la lista plana con rolledUpBalance calculado para todas.
    // La UI tendrá que reconstruir/ordenar la jerarquía si es necesario para la visualización.

    return accounts.sort((a, b) => a.code.localeCompare(b.code)); // Devolver lista plana ordenada por código

  } catch (error) {
    console.error('Error al obtener cuentas (MySQL):', error);
    return [];
  }
}


// --- Acciones para Asientos Contables ---
// ... (El resto de las acciones de asientos contables permanecen igual, pero deben usar los códigos de cuenta correctos)
// Asegurarse que la lógica de actualización de saldos en addJournalEntry sea correcta.
// Aquí, la actualizamos para que sea más precisa según el tipo de cuenta.

const ACCOUNT_TYPES_INCREASE_WITH_DEBIT = ['Activo', 'Gasto'];
const ACCOUNT_TYPES_INCREASE_WITH_CREDIT = ['Pasivo', 'Patrimonio', 'Ingreso'];

export async function addJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  const validatedFields = JournalEntrySchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    console.error('Error: Pool de conexiones no disponible.');
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { date, entryNumber, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [debitAccountRows] = await connection.query<RowDataPacket[]>('SELECT id, type FROM chart_of_accounts WHERE code = ?', [debitAccountCode]);
    const [creditAccountRows] = await connection.query<RowDataPacket[]>('SELECT id, type FROM chart_of_accounts WHERE code = ?', [creditAccountCode]);

    if (debitAccountRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'La cuenta de débito no existe.', errors: { debitAccountCode: ['Código de cuenta de débito inválido.']}};
    }
    if (creditAccountRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'La cuenta de crédito no existe.', errors: { creditAccountCode: ['Código de cuenta de crédito inválido.']}};
    }
    if (debitAccountCode === creditAccountCode) {
      await connection.rollback();
      return { success: false, message: 'Las cuentas de débito y crédito no pueden ser la misma.', errors: { creditAccountCode: ['Selecciona una cuenta diferente.']}};
    }

    const debitAccountType = debitAccountRows[0].type;
    const creditAccountType = creditAccountRows[0].type;

    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO journal_entries (date, entryNumber, description, debitAccountCode, creditAccountCode, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, amount]
    );

    // Actualizar saldos
    let debitChange = amount;
    let creditChange = amount;

    if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(debitAccountType)) {
        await connection.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [debitChange, debitAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(debitAccountType)) { // Ej: Un pago a un pasivo lo disminuye con un débito
        await connection.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [debitChange, debitAccountCode]);
    }

    if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(creditAccountType)) {
        await connection.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [creditChange, creditAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(creditAccountType)) { // Ej: Un ingreso disminuye con un crédito (si fuera una devolución)
        await connection.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [creditChange, creditAccountCode]);
    }


    await connection.commit();

    if (result.affectedRows > 0) {
      const newEntryId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Asiento contable añadido.', data: { ...validatedFields.data, id: newEntryId } };
    } else {
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

// updateJournalEntry y deleteJournalEntry requerirían una lógica compleja de reversión de saldos
// que está fuera del alcance de una simple actualización. Se recomienda gestionarlos
// mediante asientos de ajuste/reversión en lugar de modificar/eliminar directamente
// asientos que ya afectaron saldos. Por simplicidad, mantenemos las funciones básicas de update/delete
// pero ADVERTIMOS que no recalculan saldos de forma completa.

export async function updateJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  if (!data.id) return { success: false, message: 'ID de asiento requerido.' };
  const validatedFields = JournalEntrySchema.safeParse(data);
   if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    console.error('Error: Pool de conexiones no disponible.');
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id, date, entryNumber, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;

  try {
    // TODO: Implementar una lógica de transacción robusta para:
    // 1. Obtener el asiento antiguo.
    // 2. Revertir el impacto del asiento antiguo en los saldos de las cuentas.
    // 3. Actualizar el asiento con los nuevos datos.
    // 4. Aplicar el impacto del nuevo asiento (con nuevos montos/cuentas) en los saldos.
    // Esta es una simplificación extrema:
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE journal_entries SET date = ?, entryNumber = ?, description = ?, debitAccountCode = ?, creditAccountCode = ?, amount = ? WHERE id = ?',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, amount, id]
    );

    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        return { success: true, message: 'Asiento actualizado (ADVERTENCIA: Saldos no recalculados completamente).', data: { ...validatedFields.data, id: id! } };
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
    console.error('Error: Pool de conexiones no disponible.');
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  try {
    // TODO: Implementar una lógica de transacción robusta para revertir el impacto del asiento en los saldos.
    // Esta es una simplificación extrema:
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM journal_entries WHERE id = ?', [entryId]);
    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        return { success: true, message: 'Asiento eliminado (ADVERTENCIA: Saldos no recalculados completamente).' };
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
    console.error('Error: Pool de conexiones no disponible.');
    return [];
  }
  try {
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
