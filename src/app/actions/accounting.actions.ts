
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import { AccountSchema, JournalEntrySchema } from '../schemas/accounting.schemas';

export type AccountFormInput = z.infer<typeof AccountSchema>;
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;

export interface AccountWithDetails extends AccountFormInput {
  id: string;
  parent_account_id?: string | null;
  rolledUpBalance?: number;
  children?: AccountWithDetails[];
}

export interface AccountingActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any;
  data?: T & { id: string };
}

// TODO: SQL - CREATE TABLE chart_of_accounts (... parent_account_id INT NULL, FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL);
// TODO: SQL - CREATE TABLE journal_entries (...);

async function generateJournalEntryNumber(connection: Connection): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  // Obtener el último ID insertado en journal_entries como una forma simple de secuencia diaria.
  // Para un sistema más robusto, considera una tabla de secuencias o un formato diferente.
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM journal_entries WHERE DATE(created_at) = CURDATE()"
  );
  const countToday = rows[0].count + 1; // +1 porque este asiento es el siguiente

  return `AS-${year}${month}${day}-${countToday.toString().padStart(4, '0')}`;
}


export async function addAccount(
  data: AccountFormInput
): Promise<AccountingActionResponse<AccountFormInput>> {
  const validatedFields = AccountSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { code, name, type, balance, parentAccountId } = validatedFields.data;
  try {
    const parentIdValue = parentAccountId ? parseInt(parentAccountId) : null;

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO chart_of_accounts (code, name, type, balance, parent_account_id) VALUES (?, ?, ?, ?, ?)',
      [code, name, type, balance, parentIdValue]
    );
    if (result.affectedRows > 0) {
      const newAccountId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Cuenta añadida.', data: { ...validatedFields.data, id: newAccountId, parentAccountId: parentIdValue?.toString() || null } };
    } else {
      return { success: false, message: 'No se pudo añadir la cuenta.' };
    }
  } catch (error: any) {
    console.error('Error al añadir cuenta (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'Error: El código de cuenta ya existe.', errors: { code: ['Este código ya está registrado.'] } };
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: La cuenta padre no existe.', errors: { parentAccountId: ['Cuenta padre inválida.']}};
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
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id, code, name, type, parentAccountId } = validatedFields.data;
  try {
    const parentIdValue = parentAccountId ? parseInt(parentAccountId) : null;

    if (id === parentAccountId) {
        return { success: false, message: 'Una cuenta no puede ser su propia padre.', errors: { parentAccountId: ['Selecciona una cuenta padre diferente.'] } };
    }
    
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE chart_of_accounts SET code = ?, name = ?, type = ?, parent_account_id = ? WHERE id = ?',
      [code, name, type, parentIdValue, parseInt(id)]
    );
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Cuenta actualizada.', data: { ...validatedFields.data, id: id!, parentAccountId: parentIdValue?.toString() || null } };
    } else {
      return { success: false, message: 'Cuenta no encontrada o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar cuenta (MySQL):', error);
    // ... (manejo de errores similar a addAccount)
    return { success: false, message: 'Error al actualizar cuenta.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteAccount(accountId: string): Promise<AccountingActionResponse<null>> {
  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  let connection: Connection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [childrenRows] = await connection.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE parent_account_id = ?', [parseInt(accountId)]);
    if (childrenRows.length > 0) {
      await connection.rollback();
      return { success: false, message: 'No se puede eliminar: la cuenta tiene cuentas hijas.' };
    }
    
    // TODO: Verificar si la cuenta está usada en journal_entries antes de eliminar.
    // O manejarlo con ON DELETE RESTRICT en la FK de journal_entries.

    const [result] = await connection.query<ResultSetHeader>('DELETE FROM chart_of_accounts WHERE id = ?', [parseInt(accountId)]);
    await connection.commit();
    
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Cuenta eliminada.' };
    } else {
      return { success: false, message: 'Cuenta no encontrada.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al eliminar cuenta (MySQL):', error);
    if (error.errno === 1451) { 
        return { success: false, message: 'No se puede eliminar: la cuenta tiene asientos contables asociados.' };
    }
    return { success: false, message: 'Error al eliminar cuenta.', errors: { general: ['Error del servidor.'] } };
  } finally {
    if (connection) connection.release();
  }
}

export async function getAccounts(): Promise<AccountWithDetails[]> {
  if (!pool) {
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
      parent_account_id: row.parent_account_id?.toString() || null,
      rolledUpBalance: parseFloat(row.balance), 
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
    return accounts;

  } catch (error) {
    console.error('Error al obtener cuentas (MySQL):', error);
    return [];
  }
}

const ACCOUNT_TYPES_INCREASE_WITH_DEBIT = ['Activo', 'Gasto'];
const ACCOUNT_TYPES_INCREASE_WITH_CREDIT = ['Pasivo', 'Patrimonio', 'Ingreso'];

export async function addJournalEntry(
  data: JournalEntryFormInput,
  dbConnection?: Connection // Para usar en transacciones
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  const validatedFields = JournalEntrySchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  const conn = dbConnection || await pool.getConnection(); // Usa la conexión existente o crea una nueva
  if (!conn && !dbConnection) { // Si pool.getConnection() falló y no se pasó una conexión
     return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  
  const { date, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;
  let { entryNumber } = validatedFields.data;

  try {
    if (!dbConnection) await conn.beginTransaction(); // Inicia transacción solo si no estamos en una ya

    if (!entryNumber) { // Generar número de asiento si no se provee
        entryNumber = await generateJournalEntryNumber(conn);
    }

    const [debitAccountRows] = await conn.query<RowDataPacket[]>('SELECT id, type FROM chart_of_accounts WHERE code = ?', [debitAccountCode]);
    const [creditAccountRows] = await conn.query<RowDataPacket[]>('SELECT id, type FROM chart_of_accounts WHERE code = ?', [creditAccountCode]);

    if (debitAccountRows.length === 0) {
      if (!dbConnection) await conn.rollback();
      return { success: false, message: 'Cuenta de débito no existe.', errors: { debitAccountCode: ['Código inválido.']}};
    }
    if (creditAccountRows.length === 0) {
      if (!dbConnection) await conn.rollback();
      return { success: false, message: 'Cuenta de crédito no existe.', errors: { creditAccountCode: ['Código inválido.']}};
    }
    if (debitAccountCode === creditAccountCode) {
      if (!dbConnection) await conn.rollback();
      return { success: false, message: 'Débito y crédito no pueden ser la misma cuenta.', errors: { creditAccountCode: ['Selecciona una cuenta diferente.']}};
    }

    const debitAccountType = debitAccountRows[0].type;
    const creditAccountType = creditAccountRows[0].type;

    const [result] = await conn.query<ResultSetHeader>(
      'INSERT INTO journal_entries (date, entryNumber, description, debitAccountCode, creditAccountCode, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, amount]
    );

    const numericAmount = Number(amount);

    if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(debitAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, debitAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(debitAccountType)) { 
        await conn.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, debitAccountCode]);
    }

    if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(creditAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, creditAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(creditAccountType)) { 
        await conn.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, creditAccountCode]);
    }

    if (!dbConnection) await conn.commit();

    if (result.affectedRows > 0) {
      const newEntryId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Asiento contable añadido.', data: { ...validatedFields.data, id: newEntryId, entryNumber } };
    } else {
      return { success: false, message: 'No se pudo añadir el asiento.' };
    }
  } catch (error: any) {
    if (!dbConnection && conn) await conn.rollback();
    console.error('Error al añadir asiento (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'Error: El número de asiento ya existe.', errors: { entryNumber: ['Este número ya está registrado.'] } };
    }
    return { success: false, message: 'Error al añadir asiento.', errors: { general: ['Error del servidor.'] } };
  } finally {
    if (!dbConnection && conn) conn.release();
  }
}

export async function updateJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  if (!data.id) return { success: false, message: 'ID de asiento requerido.' };
  // TODO: Revertir el impacto del asiento original en los saldos y luego aplicar el impacto del nuevo asiento.
  // Esta es una operación compleja que requiere una lógica contable cuidadosa.
  // Por ahora, solo actualiza los datos del asiento sin ajustar saldos.
  // ¡ADVERTENCIA! ESTA OPERACIÓN NO ES CONTABLEMENTE CORRECTA PARA ACTUALIZAR SALDOS.
  console.warn("updateJournalEntry: La actualización de asientos no recalcula saldos correctamente. Solo para corrección de datos descriptivos.");
  
  const validatedFields = JournalEntrySchema.safeParse(data);
   if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id, date, entryNumber, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE journal_entries SET date = ?, entryNumber = ?, description = ?, debitAccountCode = ?, creditAccountCode = ?, amount = ? WHERE id = ?',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, amount, parseInt(id)]
    );

    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        return { success: true, message: 'Asiento actualizado (ADVERTENCIA: Saldos no recalculados).', data: { ...validatedFields.data, id: id! } };
    } else {
        return { success: false, message: 'Asiento no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    // ... (manejo de errores)
    return { success: false, message: 'Error al actualizar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteJournalEntry(entryId: string): Promise<AccountingActionResponse<null>> {
   if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  // TODO: Revertir el impacto del asiento en los saldos antes de eliminarlo.
  // ¡ADVERTENCIA! ESTA OPERACIÓN NO ES CONTABLEMENTE CORRECTA PARA ACTUALIZAR SALDOS.
  console.warn("deleteJournalEntry: La eliminación de asientos no recalcula saldos correctamente.");
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM journal_entries WHERE id = ?', [parseInt(entryId)]);
    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        return { success: true, message: 'Asiento eliminado (ADVERTENCIA: Saldos no recalculados).' };
    } else {
        return { success: false, message: 'Asiento no encontrado.'};
    }
  } catch (error) {
    console.error('Error al eliminar asiento (MySQL):', error);
    return { success: false, message: 'Error al eliminar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getJournalEntries(): Promise<(JournalEntryFormInput & { id: string })[]> {
  if (!pool) {
    return [];
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, entryNumber, description, debitAccountCode, creditAccountCode, amount FROM journal_entries ORDER BY date DESC, entryNumber DESC'
    );
    return rows.map(row => ({
        id: row.id.toString(),
        date: row.date,
        entryNumber: row.entryNumber,
        description: row.description,
        debitAccountCode: row.debitAccountCode,
        creditAccountCode: row.creditAccountCode,
        amount: parseFloat(row.amount)
    })) as (JournalEntryFormInput & { id: string })[];
  } catch (error) {
    console.error('Error al obtener asientos (MySQL):', error);
    return [];
  }
}

export async function getAccountBalancesSummary(): Promise<{ totalRevenue: number, totalExpenses: number, netProfit: number }> {
  if (!pool) {
    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
  }
  try {
    const [revenueRows] = await pool.query<RowDataPacket[]>("SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Ingreso'");
    const [expenseRows] = await pool.query<RowDataPacket[]>("SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Gasto'");
    
    const totalRevenue = revenueRows[0]?.total ? parseFloat(revenueRows[0].total) : 0;
    // Los gastos suelen tener saldo deudor (positivo en DB para tipo Gasto). El beneficio es Ingreso - Gasto.
    const totalExpenses = expenseRows[0]?.total ? parseFloat(expenseRows[0].total) : 0; 
    
    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses, // Simplificación, puede ser más complejo
    };
  } catch (error) {
    console.error('Error al obtener resumen de saldos (MySQL):', error);
    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
  }
}
