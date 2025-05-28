
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '../../lib/db'; // Ajustado a ruta relativa
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { AccountSchema, JournalEntrySchema } from '../schemas/accounting.schemas';

export type AccountFormInput = z.infer<typeof AccountSchema>;
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;

// Tipo extendido para incluir el saldo acumulado y la información del padre
export interface AccountWithDetails extends AccountFormInput {
  id: string;
  parent_account_id?: string | null; // Para la UI, el ID de la cuenta padre (viene de la DB como parent_account_id)
  rolledUpBalance?: number; // Saldo acumulado (directo + hijos)
  children?: AccountWithDetails[]; // Para construir la jerarquía
}


export interface AccountingActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any;
  data?: T & { id: string };
}

// TODO: SQL - CREATE TABLE chart_of_accounts (id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, type ENUM('Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Gasto') NOT NULL, balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00, parent_account_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL);
// TODO: SQL - CREATE TABLE journal_entries (id INT AUTO_INCREMENT PRIMARY KEY, date DATE NOT NULL, entryNumber VARCHAR(100) NOT NULL UNIQUE, description TEXT NOT NULL, debitAccountCode VARCHAR(50) NOT NULL, creditAccountCode VARCHAR(50) NOT NULL, amount DECIMAL(15, 2) NOT NULL, FOREIGN KEY (debitAccountCode) REFERENCES chart_of_accounts(code), FOREIGN KEY (creditAccountCode) REFERENCES chart_of_accounts(code), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);


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
    const parentIdValue = parentAccountId === "" || parentAccountId === "null" || parentAccountId === undefined || parentAccountId === null ? null : parseInt(parentAccountId);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO chart_of_accounts (code, name, type, balance, parent_account_id) VALUES (?, ?, ?, ?, ?)',
      [code, name, type, balance, parentIdValue]
    );
    if (result.affectedRows > 0) {
      const newAccountId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Cuenta añadida exitosamente.', data: { ...validatedFields.data, id: newAccountId, parentAccountId: parentAccountIdValue?.toString() || null } };
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
    const parentIdValue = parentAccountId === "" || parentAccountId === "null" || parentAccountId === undefined || parentAccountId === null ? null : parseInt(parentAccountId);

    if (id === parentAccountId) { // Evitar que una cuenta sea su propio padre
        return { success: false, message: 'Una cuenta no puede ser su propia cuenta padre.', errors: { parentAccountId: ['Selecciona una cuenta padre diferente.'] } };
    }
    // TODO: Implementar validación para evitar ciclos (ej. A padre de B, B padre de A) si es necesario.

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE chart_of_accounts SET code = ?, name = ?, type = ?, parent_account_id = ? WHERE id = ?',
      [code, name, type, parentIdValue, id]
    );
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      // No es necesario recargar aquí, la revalidación debería ser suficiente
      // Devolvemos los datos validados con el ID
      return { success: true, message: 'Cuenta actualizada.', data: { ...validatedFields.data, id: id!, parentAccountId: parentAccountIdValue?.toString() || null } };
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
    if (error.errno === 1451) { // Error de restricción de clave foránea
        return { success: false, message: 'No se puede eliminar la cuenta porque tiene asientos contables asociados o es padre de otras cuentas.' };
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
      parent_account_id: row.parent_account_id?.toString() || null, // Mantener para mapeo interno
      rolledUpBalance: parseFloat(row.balance), // Inicializar con balance directo
      children: [],
    }));

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
      let sum = account.balance;
      if (account.children && account.children.length > 0) {
        for (const child of account.children) {
          sum += calculateRolledUpBalances(child);
        }
      }
      account.rolledUpBalance = sum;
      return sum;
    }

    rootAccounts.forEach(calculateRolledUpBalances);
    
    // Devolvemos la lista plana con 'rolledUpBalance' y 'children' para que la UI pueda reconstruir la jerarquía.
    return accounts;

  } catch (error) {
    console.error('Error al obtener cuentas (MySQL):', error);
    return [];
  }
}

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

    const numericAmount = Number(amount); // Asegurarse que es un número

    if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(debitAccountType)) {
        await connection.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, debitAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(debitAccountType)) { 
        await connection.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, debitAccountCode]);
    }

    if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(creditAccountType)) {
        await connection.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, creditAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(creditAccountType)) { 
        await connection.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, creditAccountCode]);
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
    // ADVERTENCIA: Esta actualización no revierte el impacto del asiento original ni aplica el nuevo.
    // Esto es una simplificación extrema. Una implementación contable correcta requeriría una lógica mucho más compleja.
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE journal_entries SET date = ?, entryNumber = ?, description = ?, debitAccountCode = ?, creditAccountCode = ?, amount = ? WHERE id = ?',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, amount, id]
    );

    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout'); // Revalidar para refrescar datos
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
    // ADVERTENCIA: Esta eliminación no revierte el impacto del asiento en los saldos.
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM journal_entries WHERE id = ?', [entryId]);
    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout'); // Revalidar para refrescar datos
        return { success: true, message: 'Asiento eliminado (ADVERTENCIA: Saldos no recalculados completamente).' };
    } else {
        return { success: false, message: 'Asiento no encontrado para eliminar.'};
    }
  } catch (error) {
    console.error('Error al eliminar asiento (MySQL):', error);
    return { success: false, message: 'Error al eliminar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getJournalEntries(): Promise<(JournalEntryFormInput & { id: string })[]> {
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
    })) as (JournalEntryFormInput & { id: string })[];
  } catch (error) {
    console.error('Error al obtener asientos (MySQL):', error);
    return [];
  }
}

    