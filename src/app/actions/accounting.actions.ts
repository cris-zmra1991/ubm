
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
  parent_account_id?: string | null; // Usado internamente en el backend
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

  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM journal_entries WHERE DATE(created_at) = CURDATE()"
  );
  const countToday = rows[0].count + 1;

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

    if (id === parentAccountId) { // Prevenir que una cuenta sea su propia padre
        return { success: false, message: 'Una cuenta no puede ser su propia cuenta padre.', errors: { parentAccountId: ['Selecciona una cuenta padre diferente.'] } };
    }

    // TODO: Prevenir ciclos (A es padre de B, B es padre de A) - esto es más complejo y requiere recorrer el árbol.

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE chart_of_accounts SET code = ?, name = ?, type = ?, parent_account_id = ? WHERE id = ?',
      // No se actualiza el balance directamente aquí; se hace a través de asientos.
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
     if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'Error: El código de cuenta ya existe.', errors: { code: ['Este código ya está registrado.'] } };
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: La cuenta padre no existe.', errors: { parentAccountId: ['Cuenta padre inválida.']}};
    }
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

    // Verificar si la cuenta tiene cuentas hijas
    const [childrenRows] = await connection.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE parent_account_id = ?', [parseInt(accountId)]);
    if (childrenRows.length > 0) {
      await connection.rollback();
      return { success: false, message: 'No se puede eliminar: la cuenta tiene cuentas hijas asignadas. Reasigna o elimina las cuentas hijas primero.' };
    }

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
    if (error.errno === 1451) { // Error de FK, la cuenta está usada en asientos o como padre de otras
        return { success: false, message: 'No se puede eliminar: la cuenta está referenciada en asientos contables u otras configuraciones (ej. productos).' };
    }
    return { success: false, message: 'Error al eliminar cuenta.', errors: { general: ['Error del servidor.'] } };
  } finally {
    if (connection) connection.release();
  }
}

export async function getAccounts(): Promise<AccountWithDetails[]> {
  if (!pool) { return []; }
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
      parent_account_id: row.parent_account_id?.toString() || null, // Para la construcción del árbol
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

    // Función recursiva para calcular saldos acumulados
    function calculateRolledUpBalances(account: AccountWithDetails): number {
      let sum = account.balance; // Empieza con el saldo directo de la cuenta
      if (account.children && account.children.length > 0) {
        for (const child of account.children) {
          sum += calculateRolledUpBalances(child); // Suma el saldo acumulado de cada hijo
        }
      }
      account.rolledUpBalance = sum;
      return sum;
    }

    // Calcular saldos acumulados para todas las cuentas raíz (y sus descendientes)
    rootAccounts.forEach(calculateRolledUpBalances);

    return accounts; // Devuelve la lista plana, pero con rolledUpBalance y children populados

  } catch (error) {
    console.error('Error al obtener cuentas (MySQL):', error);
    return [];
  }
}

// Tipos de cuenta que aumentan con un débito / disminuyen con un crédito
const ACCOUNT_TYPES_INCREASE_WITH_DEBIT = ['Activo', 'Gasto'];
// Tipos de cuenta que aumentan con un crédito / disminuyen con un débito
const ACCOUNT_TYPES_INCREASE_WITH_CREDIT = ['Pasivo', 'Patrimonio', 'Ingreso'];

export async function addJournalEntry(
  data: JournalEntryFormInput,
  dbConnection?: Connection // Para usar en transacciones
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  const validatedFields = JournalEntrySchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  const conn = dbConnection || await pool.getConnection();
  if (!conn && !dbConnection) {
     return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { date, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;
  let { entryNumber } = validatedFields.data;

  try {
    if (!dbConnection) await conn.beginTransaction();

    if (!entryNumber) {
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
    const numericAmount = Number(amount);

    // Insertar el asiento
    const [result] = await conn.query<ResultSetHeader>(
      'INSERT INTO journal_entries (date, entryNumber, description, debitAccountCode, creditAccountCode, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, numericAmount]
    );

    // Actualizar saldo de la cuenta de débito
    if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(debitAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, debitAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(debitAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, debitAccountCode]);
    }

    // Actualizar saldo de la cuenta de crédito
    if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(creditAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, creditAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(creditAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, creditAccountCode]);
    }

    if (!dbConnection) await conn.commit();

    if (result.affectedRows > 0) {
      const newEntryId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      revalidatePath('/', 'layout'); // Revalidar dashboard por si cambian los balances
      return { success: true, message: 'Asiento contable añadido.', data: { ...validatedFields.data, id: newEntryId, entryNumber } };
    } else {
      // Esto no debería pasar si la inserción fue exitosa
      return { success: false, message: 'No se pudo añadir el asiento.' };
    }
  } catch (error: any) {
    if (!dbConnection && conn) await conn.rollback();
    console.error('Error al añadir asiento (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('entryNumber')) {
        return { success: false, message: 'Error: El número de asiento ya existe.', errors: { entryNumber: ['Este número ya está registrado. Intenta de nuevo.'] } };
    }
    return { success: false, message: 'Error al añadir asiento.', errors: { general: ['Error del servidor al procesar el asiento.'] } };
  } finally {
    if (!dbConnection && conn && pool) (conn as Connection).release();
  }
}

export async function updateJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  if (!data.id) return { success: false, message: 'ID de asiento requerido.' };
  // ¡ADVERTENCIA! Esta función SOLO actualiza los datos descriptivos del asiento.
  // NO revierte ni reaplica el impacto en los saldos de las cuentas.
  // Para una corrección contable completa, se necesitaría revertir el asiento original
  // y crear uno nuevo, o crear asientos de ajuste.
  console.warn("updateJournalEntry: Actualización no afecta saldos. Solo para corrección de datos descriptivos.");

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
    console.error('Error al actualizar asiento (MySQL):', error);
    return { success: false, message: 'Error al actualizar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteJournalEntry(entryId: string): Promise<AccountingActionResponse<null>> {
   if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  // ¡ADVERTENCIA! Esta función SOLO elimina el asiento.
  // NO revierte el impacto original en los saldos de las cuentas.
  // Para una corrección contable, se necesitaría crear un asiento de reversión.
  console.warn("deleteJournalEntry: Eliminación no revierte impacto en saldos.");
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM journal_entries WHERE id = ?', [parseInt(entryId)]);
    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        revalidatePath('/', 'layout'); // Revalidar dashboard por si cambian los balances
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
  if (!pool) { return []; }
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
    // Suma de los saldos directos de las cuentas de Ingreso y Gasto.
    // El saldo de Ingreso usualmente es negativo (haber) en el sistema de saldos (ej, -5000).
    // El saldo de Gasto usualmente es positivo (debe) en el sistema de saldos (ej, 2000).
    // Beneficio = ABS(Ingresos) - ABS(Gastos) o Ingresos_Netos - Gastos_Netos
    // Para HSL, los ingresos aumentan con crédito (saldo negativo), gastos con débito (saldo positivo).
    const [revenueRows] = await pool.query<RowDataPacket[]>("SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Ingreso'");
    const [expenseRows] = await pool.query<RowDataPacket[]>("SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Gasto'");

    const totalRevenue = revenueRows[0]?.total ? Math.abs(parseFloat(revenueRows[0].total)) : 0; // Ingresos son negativos, tomamos absoluto
    const totalExpenses = expenseRows[0]?.total ? parseFloat(expenseRows[0].total) : 0; // Gastos son positivos

    return {
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
    };
  } catch (error) {
    console.error('Error al obtener resumen de saldos (MySQL):', error);
    return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
  }
}
