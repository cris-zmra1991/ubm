
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import { AccountSchema, JournalEntrySchema, FiscalYearSchema, CompanyAccountingSettingsSchema, type FiscalYearFormInput } from '../schemas/accounting.schemas';
import type { CompanyInfoFormInput } from '../schemas/admin.schemas'; // Necesitamos el tipo para company_info
import { getSession, type SessionPayload } from '@/lib/session';


export type AccountFormInput = z.infer<typeof AccountSchema>;
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;
export type CompanyAccountingSettingsFormInput = z.infer<typeof CompanyAccountingSettingsSchema>;


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
  data?: T extends any[] ? (T[0] & { id: string | number })[] : T & { id: string | number };
}

export interface FiscalYear extends FiscalYearFormInput {
    id: number;
    closed_at?: string | null;
    closed_by_user_id?: number | null;
    closed_by_username?: string | null;
}

// --- Helpers para configuraciones globales ---
async function getCompanyInfoDetails(): Promise<(CompanyInfoFormInput & {currentFiscalYearId?: number | null, retainedEarningsAccountId?: number | null}) | null> {
    if (!pool) return null;
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT *, current_fiscal_year_id as currentFiscalYearId, retained_earnings_account_id as retainedEarningsAccountId FROM company_info WHERE id = 1');
        if (rows.length > 0) {
            return rows[0] as (CompanyInfoFormInput & {currentFiscalYearId?: number | null, retainedEarningsAccountId?: number | null});
        }
        return null;
    } catch (error) {
        console.error("Error al obtener información de la empresa:", error);
        return null;
    }
}


async function getActiveFiscalYear(connection?: Connection): Promise<FiscalYear | null> {
    const conn = connection || pool;
    if (!conn) return null;
    const companyInfo = await getCompanyInfoDetails();
    if (!companyInfo || !companyInfo.currentFiscalYearId) {
        return null;
    }
    const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id, name, DATE_FORMAT(start_date, "%Y-%m-%d") as startDate, DATE_FORMAT(end_date, "%Y-%m-%d") as endDate, is_closed as isClosed FROM fiscal_years WHERE id = ?',
        [companyInfo.currentFiscalYearId]
    );
    if (rows.length === 0) return null;
    return { ...rows[0], isClosed: Boolean(rows[0].isClosed) } as FiscalYear;
}

async function getRetainedEarningsAccount(connection?: Connection): Promise<AccountWithDetails | null> {
    const conn = connection || pool;
    if (!conn) return null;
    const companyInfo = await getCompanyInfoDetails();
    if (!companyInfo || !companyInfo.retainedEarningsAccountId) {
        return null;
    }
    const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id, code, name, type, balance FROM chart_of_accounts WHERE id = ? AND type = "Patrimonio"',
        [companyInfo.retainedEarningsAccountId]
    );
    if (rows.length === 0) return null;
    return { ...rows[0], id: rows[0].id.toString(), balance: parseFloat(rows[0].balance) } as AccountWithDetails;
}


async function generateJournalEntryNumber(connection: Connection): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  // TODO: SQL - Esta forma de generar secuenciales puede tener problemas de concurrencia en sistemas de alto tráfico.
  // Considerar una secuencia de BD, una tabla de contadores dedicada, o un UUID.
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM journal_entries WHERE DATE(date) = CURDATE()"
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
    if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('fk_chart_of_accounts_parent')) {
        return { success: false, message: 'Error: La cuenta padre seleccionada no existe.', errors: { parentAccountId: ['Cuenta padre inválida.']}};
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
        return { success: false, message: 'Una cuenta no puede ser su propia cuenta padre.', errors: { parentAccountId: ['Selecciona una cuenta padre diferente.'] } };
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
     if (error.code === 'ER_DUP_ENTRY') {
        return { success: false, message: 'Error: El código de cuenta ya existe.', errors: { code: ['Este código ya está registrado.'] } };
    }
     if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('fk_chart_of_accounts_parent')) {
        return { success: false, message: 'Error: La cuenta padre seleccionada no existe.', errors: { parentAccountId: ['Cuenta padre inválida.']}};
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
    if (error.errno === 1451 || (error.code && error.code.includes('ER_ROW_IS_REFERENCED'))) {
        return { success: false, message: 'No se puede eliminar: la cuenta está referenciada en asientos contables, productos u otras configuraciones.' };
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

    accounts.forEach(acc => {
        if (accountMap.has(acc.id)) {
            acc.rolledUpBalance = accountMap.get(acc.id)!.rolledUpBalance;
        }
    });
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
  dbConnection?: Connection
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  const validatedFields = JournalEntrySchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación de asiento.', errors: validatedFields.error.flatten().fieldErrors };
  }

  const conn = dbConnection || await pool.getConnection();
  if (!conn && !dbConnection) {
     return { success: false, message: 'Error del servidor: DB no disponible para asiento.' };
  }

  const { date, description, debitAccountCode, creditAccountCode, amount } = validatedFields.data;
  let { entryNumber } = validatedFields.data;
  let fiscalYearIdToUse = data.fiscalYearId;

  try {
    if (!dbConnection) await conn.beginTransaction();

    if (!entryNumber || entryNumber.trim() === '') {
        entryNumber = await generateJournalEntryNumber(conn);
    }

    if (!fiscalYearIdToUse) {
        const activeFiscalYear = await getActiveFiscalYear(conn);
        if (!activeFiscalYear || activeFiscalYear.isClosed) {
          if (!dbConnection) await conn.rollback();
          return { success: false, message: 'No hay un año fiscal activo abierto para registrar el asiento.' };
        }
        if (new Date(date) < new Date(activeFiscalYear.startDate) || new Date(date) > new Date(activeFiscalYear.endDate)) {
          if (!dbConnection) await conn.rollback();
          return { success: false, message: `La fecha del asiento (${date}) no está dentro del año fiscal activo (${activeFiscalYear.startDate} - ${activeFiscalYear.endDate}).` };
        }
        fiscalYearIdToUse = activeFiscalYear.id;
    } else {
        const [fyRows] = await conn.query<RowDataPacket[]>('SELECT start_date, end_date, is_closed FROM fiscal_years WHERE id = ?', [fiscalYearIdToUse]);
        if (fyRows.length === 0 || fyRows[0].is_closed) {
             if (!dbConnection) await conn.rollback();
             return { success: false, message: 'El año fiscal especificado no es válido o está cerrado.' };
        }
         if (new Date(date) < new Date(fyRows[0].start_date) || new Date(date) > new Date(fyRows[0].end_date)) {
            if (!dbConnection) await conn.rollback();
            return { success: false, message: `La fecha del asiento (${date}) no está dentro del año fiscal seleccionado (${fyRows[0].start_date} - ${fyRows[0].end_date}).` };
        }
    }


    const [debitAccountRows] = await conn.query<RowDataPacket[]>('SELECT id, type, balance FROM chart_of_accounts WHERE code = ?', [debitAccountCode]);
    const [creditAccountRows] = await conn.query<RowDataPacket[]>('SELECT id, type, balance FROM chart_of_accounts WHERE code = ?', [creditAccountCode]);

    if (debitAccountRows.length === 0) { /* ... manejo de error ... */ return { success: false, message: 'Cuenta de débito no existe.'}; }
    if (creditAccountRows.length === 0) { /* ... manejo de error ... */ return { success: false, message: 'Cuenta de crédito no existe.'}; }
    if (debitAccountCode === creditAccountCode) { /* ... manejo de error ... */ return { success: false, message: 'Débito y crédito no pueden ser la misma cuenta.'}; }

    const debitAccountType = debitAccountRows[0].type;
    const creditAccountType = creditAccountRows[0].type;
    const numericAmount = Number(amount);

    const [result] = await conn.query<ResultSetHeader>(
      'INSERT INTO journal_entries (date, entryNumber, description, debitAccountCode, creditAccountCode, amount, fiscal_year_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, numericAmount, fiscalYearIdToUse]
    );

    let newDebitBalance = parseFloat(debitAccountRows[0].balance);
    if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(debitAccountType)) { newDebitBalance += numericAmount; }
    else if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(debitAccountType)) { newDebitBalance -= numericAmount; }
    await conn.query('UPDATE chart_of_accounts SET balance = ? WHERE code = ?', [newDebitBalance, debitAccountCode]);

    let newCreditBalance = parseFloat(creditAccountRows[0].balance);
    if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(creditAccountType)) { newCreditBalance += numericAmount; }
    else if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(creditAccountType)) { newCreditBalance -= numericAmount; }
    await conn.query('UPDATE chart_of_accounts SET balance = ? WHERE code = ?', [newCreditBalance, creditAccountCode]);


    if (!dbConnection) await conn.commit();

    if (result.affectedRows > 0) {
      const newEntryId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      revalidatePath('/', 'layout');
      return { success: true, message: 'Asiento contable añadido.', data: { ...validatedFields.data, id: newEntryId, entryNumber: entryNumber!, fiscalYearId: fiscalYearIdToUse } };
    } else {
      if (!dbConnection) await conn.rollback();
      return { success: false, message: 'No se pudo añadir el asiento.' };
    }
  } catch (error: any) {
    if (!dbConnection && conn) await conn.rollback();
    console.error('Error al añadir asiento (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('entryNumber')) {
        return { success: false, message: 'Error: El número de asiento ya existe.', errors: { entryNumber: ['Este número ya está registrado. Intenta de nuevo.'] } };
    }
    return { success: false, message: `Error al añadir asiento: ${error.message}`, errors: { general: ['Error del servidor al procesar el asiento.'] } };
  } finally {
    if (!dbConnection && conn && typeof (conn as Connection).release === 'function') {
        (conn as Connection).release();
    }
  }
}
// ... (resto de updateJournalEntry, deleteJournalEntry sin cambios importantes para este feature)
export async function updateJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  console.warn("updateJournalEntry: La edición de asientos contables que afectan saldos es compleja y no se implementa completamente. Solo para datos descriptivos.");
  if (!data.id) return { success: false, message: 'ID de asiento requerido.' };
  const validatedFields = JournalEntrySchema.safeParse(data);
   if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
  const { id, date, entryNumber, description } = validatedFields.data;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE journal_entries SET date = ?, entryNumber = ?, description = ? WHERE id = ?',
      [date, entryNumber, description, parseInt(id)]
    );
    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        return { success: true, message: 'Asiento actualizado (solo datos descriptivos).', data: { ...validatedFields.data, id: id!, entryNumber: entryNumber!, fiscalYearId: data.fiscalYearId } };
    } else {
        return { success: false, message: 'Asiento no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar asiento (MySQL):', error);
    return { success: false, message: 'Error al actualizar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteJournalEntry(entryId: string): Promise<AccountingActionResponse<null>> {
   console.warn("deleteJournalEntry: La eliminación de asientos no revierte impacto en saldos y generalmente no se recomienda. Considere asientos de reversión.");
   if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
  try {
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM journal_entries WHERE id = ?', [parseInt(entryId)]);
    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        revalidatePath('/', 'layout');
        return { success: true, message: 'Asiento eliminado (ADVERTENCIA: Saldos de cuentas no recalculados).' };
    } else {
        return { success: false, message: 'Asiento no encontrado.'};
    }
  } catch (error) {
    console.error('Error al eliminar asiento (MySQL):', error);
    return { success: false, message: 'Error al eliminar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}


export async function getJournalEntries(fiscalYearIdInput?: number | null): Promise<(JournalEntryFormInput & { id: string })[]> {
  if (!pool) { return []; }
  let fiscalYearIdToQuery = fiscalYearIdInput;
  if (fiscalYearIdToQuery === undefined && fiscalYearIdInput !== null) { // Si es undefined pero no explícitamente null, intenta obtener el activo
      const activeFiscalYear = await getActiveFiscalYear();
      if (activeFiscalYear) fiscalYearIdToQuery = activeFiscalYear.id;
      // Si sigue siendo undefined y no hay activo, se traerán todos (o ninguno si no hay año fiscal activo)
  }


  try {
    let query = 'SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, entryNumber, description, debitAccountCode, creditAccountCode, amount, fiscal_year_id as fiscalYearId FROM journal_entries';
    const params: any[] = [];
    if (fiscalYearIdToQuery) {
        query += ' WHERE fiscal_year_id = ?';
        params.push(fiscalYearIdToQuery);
    }
    query += ' ORDER BY date DESC, entryNumber DESC';

    const [rows] = await pool.query<RowDataPacket[]>(query, params);
    return rows.map(row => ({
        id: row.id.toString(),
        date: row.date,
        entryNumber: row.entryNumber,
        description: row.description,
        debitAccountCode: row.debitAccountCode,
        creditAccountCode: row.creditAccountCode,
        amount: parseFloat(row.amount),
        fiscalYearId: row.fiscalYearId
    })) as (JournalEntryFormInput & { id: string })[];
  } catch (error) {
    console.error('Error al obtener asientos (MySQL):', error);
    return [];
  }
}

export async function getAccountBalancesSummary(fiscalYearIdInput?: number): Promise<{ totalRevenue: number, totalExpenses: number, netProfit: number }> {
  if (!pool) { return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 }; }

  let fiscalYearIdToQuery = fiscalYearIdInput;
   if (fiscalYearIdToQuery === undefined) {
      const activeFiscalYear = await getActiveFiscalYear();
      if (activeFiscalYear) fiscalYearIdToQuery = activeFiscalYear.id;
      else return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 }; // No hay año fiscal para calcular
  }

  try {
    let revenueQuery = "SELECT SUM(je.amount) as total FROM journal_entries je JOIN chart_of_accounts ca ON je.creditAccountCode = ca.code WHERE ca.type = 'Ingreso'";
    let expenseQuery = "SELECT SUM(je.amount) as total FROM journal_entries je JOIN chart_of_accounts ca ON je.debitAccountCode = ca.code WHERE ca.type = 'Gasto'";
    const queryParams: any[] = [];

    if (fiscalYearIdToQuery) {
      revenueQuery += " AND je.fiscal_year_id = ?";
      expenseQuery += " AND je.fiscal_year_id = ?";
      queryParams.push(fiscalYearIdToQuery); // Se aplica a ambos queries si se usa el mismo array
    } else {
      // Si no hay fiscalYearIdToQuery, los totales serán globales (no ideal para un resumen por período)
      // Devolver 0 si no hay un año fiscal claro para el resumen.
      return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
    }


    const [revenueRows] = await pool.query<RowDataPacket[]>(revenueQuery, queryParams);
    const [expenseRows] = await pool.query<RowDataPacket[]>(expenseQuery, queryParams);

    const totalRevenue = revenueRows[0]?.total ? parseFloat(revenueRows[0].total) : 0;
    const totalExpenses = expenseRows[0]?.total ? parseFloat(expenseRows[0].total) : 0;

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

export interface BalanceSheetData {
  assets: AccountWithDetails[];
  liabilities: AccountWithDetails[];
  equity: AccountWithDetails[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  reportDate: string;
}

export async function generateBalanceSheet(fiscalYearIdInput?: number): Promise<BalanceSheetData> {
  if (!pool) throw new Error('DB no disponible.');

  let fiscalYearToQuery: FiscalYear | null = null;
  if (fiscalYearIdInput) {
      const [fyRows] = await pool.query<RowDataPacket[]>('SELECT id, name, DATE_FORMAT(start_date, "%Y-%m-%d") as startDate, DATE_FORMAT(end_date, "%Y-%m-%d") as endDate, is_closed as isClosed FROM fiscal_years WHERE id = ?', [fiscalYearIdInput]);
      if (fyRows.length > 0) fiscalYearToQuery = { ...fyRows[0], isClosed: Boolean(fyRows[0].isClosed) } as FiscalYear;
  } else {
      fiscalYearToQuery = await getActiveFiscalYear();
  }

  if (!fiscalYearToQuery) throw new Error("Año fiscal no especificado o no encontrado para el Balance General.");
  const reportDate = fiscalYearToQuery.endDate;


  try {
    // Para un Balance General preciso, los saldos de las cuentas de Balance (Activo, Pasivo, Patrimonio)
    // deben ser los saldos al final del `reportDate`.
    // Se deben tomar los saldos de `chart_of_accounts` (que representan el acumulado hasta el último cierre)
    // y sumar/restar los movimientos del `journal_entries` para el período actual (desde el inicio del `fiscalYearToQuery` hasta `reportDate`).
    // Esta es una simplificación:
    const allAccounts = await getAccounts(); // Esta función actualmente devuelve saldos acumulados globales

    // TODO: Refinar el cálculo de saldos para el Balance General.
    // Por ahora, se usan los saldos de `chart_of_accounts` que son acumulados globales.
    // Para un balance a una fecha, necesitaríamos:
    // 1. Saldos de apertura (del cierre anterior).
    // 2. Suma de movimientos del periodo actual hasta la fecha del informe para cada cuenta de balance.

    const assets = allAccounts.filter(acc => acc.type === 'Activo' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));
    const liabilities = allAccounts.filter(acc => acc.type === 'Pasivo' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));
    const equityAccounts = allAccounts.filter(acc => acc.type === 'Patrimonio' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));

    // Calcular el Net Income del período actual para añadirlo al Patrimonio
    const incomeStatementForPeriod = await generateIncomeStatement(fiscalYearToQuery.id);
    const netIncomeOfPeriod = incomeStatementForPeriod.netIncome;

    const totalAssets = assets.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0); // Saldos pasivos son usualmente créditos (positivos en DB si usamos esa convención)
    
    // El Patrimonio = Saldo inicial Patrimonio + Beneficio Neto del Periodo
    // El `rolledUpBalance` de las cuentas de patrimonio de `getAccounts` ya incluye el saldo de la cuenta de Resultados Acumulados.
    // Si el cierre del año anterior transfirió el beneficio a Resultados Acumulados, y generateIncomeStatement
    // calcula el del periodo actual, entonces:
    let totalEquity = equityAccounts.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    // Si el año fiscal actual NO está cerrado Y estamos generando el balance para el final de este año fiscal activo,
    // y la cuenta de "Resultados del Ejercicio" aún no se ha actualizado con el cierre,
    // debemos sumar el beneficio neto del período actual al patrimonio.
    // Si el `retainedEarningsAccountId` ya refleja el resultado del período a través de los asientos de cierre (hechos por `closeFiscalYearProcess`), entonces no sumar de nuevo.
    // Para un balance "en curso" durante el año, se suele mostrar el patrimonio inicial + resultado del ejercicio hasta la fecha.
    // Para simplificar, el `closeFiscalYearProcess` actualiza la cuenta de resultados acumulados.
    // Si el año NO está cerrado, el `netIncomeOfPeriod` calculado por `generateIncomeStatement` es el del año en curso.
    // Si el año YA está cerrado, el `netIncomeOfPeriod` será 0 (o cercano) porque las cuentas de resultado se cerraron.
    if (!fiscalYearToQuery.isClosed) {
        // Esto es una aproximación. Un sistema completo tendría una cuenta "Resultados del Ejercicio (actual)"
        // y la sumaría aquí. Si `retainedEarningsAccountId` es la única cuenta para esto, su saldo se
        // actualiza solo al cierre.
        // totalEquity += netIncomeOfPeriod; // Esta línea podría duplicar el beneficio si ya se reflejó en la cuenta de resultados.
    }


    return {
      assets,
      liabilities,
      equity: equityAccounts,
      totalAssets,
      totalLiabilities: Math.abs(totalLiabilities),
      totalEquity: Math.abs(totalEquity),
      totalLiabilitiesAndEquity: Math.abs(totalLiabilities) + Math.abs(totalEquity),
      reportDate
    };
  } catch (error) {
    console.error('Error al generar Balance General (MySQL):', error);
    throw error;
  }
}

export interface IncomeStatementData {
  revenues: AccountWithDetails[];
  expenses: AccountWithDetails[];
  totalRevenues: number;
  totalExpenses: number;
  netIncome: number;
  reportPeriod: string;
}

export async function generateIncomeStatement(fiscalYearIdInput?: number): Promise<IncomeStatementData> {
  if (!pool) throw new Error('DB no disponible.');
  let fiscalYearToQuery: FiscalYear | null = null;

  if (fiscalYearIdInput) {
      const [fyRows] = await pool.query<RowDataPacket[]>('SELECT id, name, DATE_FORMAT(start_date, "%Y-%m-%d") as startDate, DATE_FORMAT(end_date, "%Y-%m-%d") as endDate, is_closed as isClosed FROM fiscal_years WHERE id = ?', [fiscalYearIdInput]);
      if (fyRows.length > 0) fiscalYearToQuery = { ...fyRows[0], isClosed: Boolean(fyRows[0].isClosed) } as FiscalYear;
  } else {
      fiscalYearToQuery = await getActiveFiscalYear();
  }

  if (!fiscalYearToQuery) throw new Error("Año fiscal no especificado o no encontrado para el Estado de Resultados.");
  const reportPeriod = `${fiscalYearToQuery.startDate} al ${fiscalYearToQuery.endDate}`;


  try {
    const accounts = await getAccounts();
    const accountMap = new Map(accounts.map(acc => [acc.code, acc]));

    let revenueQuery = "SELECT ca.code, ca.name, SUM(je.amount) as period_total FROM journal_entries je JOIN chart_of_accounts ca ON je.creditAccountCode = ca.code WHERE ca.type = 'Ingreso' AND je.fiscal_year_id = ? GROUP BY ca.code, ca.name ORDER BY ca.code";
    let expenseQuery = "SELECT ca.code, ca.name, SUM(je.amount) as period_total FROM journal_entries je JOIN chart_of_accounts ca ON je.debitAccountCode = ca.code WHERE ca.type = 'Gasto' AND je.fiscal_year_id = ? GROUP BY ca.code, ca.name ORDER BY ca.code";
    const queryParams = [fiscalYearToQuery.id];

    const [revenueRows] = await pool.query<RowDataPacket[]>(revenueQuery, queryParams);
    const [expenseRows] = await pool.query<RowDataPacket[]>(expenseQuery, queryParams);

    const revenues: AccountWithDetails[] = revenueRows.map(r => ({
        ...(accountMap.get(r.code) || { id: r.code, code: r.code, name: r.name, type: 'Ingreso', balance: 0 }),
        balance: parseFloat(r.period_total) || 0,
        rolledUpBalance: parseFloat(r.period_total) || 0
    }));
    const expenses: AccountWithDetails[] = expenseRows.map(e => ({
        ...(accountMap.get(e.code) || { id: e.code, code: e.code, name: e.name, type: 'Gasto', balance: 0 }),
        balance: parseFloat(e.period_total) || 0,
        rolledUpBalance: parseFloat(e.period_total) || 0
    }));

    const totalRevenues = revenues.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalExpenses = expenses.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    return {
      revenues,
      expenses,
      totalRevenues,
      totalExpenses,
      netIncome: totalRevenues - totalExpenses,
      reportPeriod
    };
  } catch (error) {
    console.error('Error al generar Estado de Resultados (MySQL):', error);
    throw error;
  }
}

export interface MonthlyIncomeExpense {
  month: string;
  revenue: number;
  expenses: number;
}

export async function getIncomeVsExpenseChartData(months: number = 6, fiscalYearIdInput?: number): Promise<MonthlyIncomeExpense[]> {
  if (!pool) return [];
  let fiscalYearToQuery: FiscalYear | null = null;

  if (fiscalYearIdInput) {
      const [fyRows] = await pool.query<RowDataPacket[]>('SELECT id, name, DATE_FORMAT(start_date, "%Y-%m-%d") as startDate, DATE_FORMAT(end_date, "%Y-%m-%d") as endDate FROM fiscal_years WHERE id = ?', [fiscalYearIdInput]);
      if (fyRows.length > 0) fiscalYearToQuery = fyRows[0] as FiscalYear;
  } else {
      fiscalYearToQuery = await getActiveFiscalYear();
  }

  if (!fiscalYearToQuery) return []; // No hay año fiscal para el gráfico


  try {
    let query = `
      SELECT
        DATE_FORMAT(je.date, '%Y-%m') AS entry_month,
        SUM(CASE WHEN ca_credit.type = 'Ingreso' THEN je.amount ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN ca_debit.type = 'Gasto' THEN je.amount ELSE 0 END) AS total_expenses
      FROM journal_entries je
      LEFT JOIN chart_of_accounts ca_debit ON je.debitAccountCode = ca_debit.code
      LEFT JOIN chart_of_accounts ca_credit ON je.creditAccountCode = ca_credit.code
      WHERE je.fiscal_year_id = ?
      GROUP BY entry_month
      ORDER BY entry_month ASC
      LIMIT ?;
    `;
    const queryParams: any[] = [fiscalYearToQuery.id, months];

    const [refinedRows] = await pool.query<RowDataPacket[]>(query, queryParams);

    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    return refinedRows.map(row => {
        const [year, monthNum] = (row.entry_month as string).split('-');
        return {
            month: `${monthNames[parseInt(monthNum) - 1]} ${year.substring(2)}`,
            revenue: parseFloat(row.total_revenue) || 0,
            expenses: parseFloat(row.total_expenses) || 0,
        };
    });
  } catch (error) {
    console.error('Error al obtener datos para gráfico Ingresos vs Gastos (MySQL):', error);
    return [];
  }
}


// --- Acciones para Año Fiscal ---
export async function getFiscalYears(): Promise<FiscalYear[]> {
  if (!pool) return [];
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT fy.id, fy.name, DATE_FORMAT(fy.start_date, "%Y-%m-%d") as startDate, DATE_FORMAT(fy.end_date, "%Y-%m-%d") as endDate, fy.is_closed as isClosed, DATE_FORMAT(fy.closed_at, "%Y-%m-%d %H:%i:%s") as closed_at, fy.closed_by_user_id, u.username as closed_by_username
       FROM fiscal_years fy
       LEFT JOIN users u ON fy.closed_by_user_id = u.id
       ORDER BY fy.start_date DESC`
    );
    return rows.map(row => ({
        ...row,
        isClosed: Boolean(row.isClosed)
    })) as FiscalYear[];
  } catch (error) {
    console.error('Error al obtener años fiscales:', error);
    return [];
  }
}

export async function addFiscalYear(data: FiscalYearFormInput): Promise<AccountingActionResponse<FiscalYear>> {
  const validatedFields = FiscalYearSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };

  const { name, startDate, endDate } = validatedFields.data;
  try {
    // TODO: SQL - Verificar que no haya solapamiento con otros años fiscales
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO fiscal_years (name, start_date, end_date) VALUES (?, ?, ?)',
      [name, startDate, endDate]
    );
    if (result.insertId) {
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Año fiscal añadido.', data: { ...validatedFields.data, id: result.insertId } };
    }
    return { success: false, message: 'No se pudo añadir el año fiscal.' };
  } catch (error: any) {
    console.error('Error al añadir año fiscal:', error);
     if (error.code === 'ER_DUP_ENTRY' && error.message.includes('name')) {
        return { success: false, message: 'Error: Ya existe un año fiscal con ese nombre.', errors: { name: ['Este nombre ya está en uso.'] } };
    }
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('idx_fiscal_year_dates')) {
        return { success: false, message: 'Error: Las fechas de este año fiscal se solapan con uno existente.', errors: { startDate: ['Conflicto de fechas.'], endDate: ['Conflicto de fechas.'] } };
    }
    return { success: false, message: 'Error al añadir año fiscal.' };
  }
}

export async function updateFiscalYear(id: number, data: FiscalYearFormInput): Promise<AccountingActionResponse<FiscalYear>> {
  const validatedFields = FiscalYearSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
  const { name, startDate, endDate } = validatedFields.data;

  try {
    const [currentFyRows] = await pool.query<RowDataPacket[]>('SELECT is_closed FROM fiscal_years WHERE id = ?', [id]);
    if(currentFyRows.length === 0) return { success: false, message: 'Año fiscal no encontrado.'};
    if(currentFyRows[0].is_closed) return { success: false, message: 'No se puede modificar un año fiscal cerrado.'};

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE fiscal_years SET name = ?, start_date = ?, end_date = ? WHERE id = ?',
      [name, startDate, endDate, id]
    );
    if (result.affectedRows > 0) {
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Año fiscal actualizado.', data: { ...validatedFields.data, id } };
    }
    return { success: false, message: 'Año fiscal no encontrado o sin cambios.' };
  } catch (error: any) {
    console.error('Error al actualizar año fiscal:', error);
     if (error.code === 'ER_DUP_ENTRY' && error.message.includes('name')) { /* ... */ return { success: false, message: 'Error: Nombre de año fiscal duplicado.'}; }
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('idx_fiscal_year_dates')) { /* ... */ return { success: false, message: 'Error: Fechas de año fiscal solapadas.'}; }
    return { success: false, message: 'Error al actualizar año fiscal.' };
  }
}

export async function deleteFiscalYear(id: number): Promise<AccountingActionResponse<null>> {
    if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
    try {
        const [fyRows] = await pool.query<RowDataPacket[]>('SELECT is_closed FROM fiscal_years WHERE id = ?', [id]);
        if(fyRows.length === 0) return { success: false, message: 'Año fiscal no encontrado.'};
        if(fyRows[0].is_closed) return { success: false, message: 'No se puede eliminar un año fiscal cerrado.'};
        
        const companySettings = await getCompanyInfoDetails();
        if (companySettings?.currentFiscalYearId === id) {
            return { success: false, message: 'No se puede eliminar el año fiscal activo actual.' };
        }

        const [result] = await pool.query<ResultSetHeader>('DELETE FROM fiscal_years WHERE id = ?', [id]);
        if (result.affectedRows > 0) {
            revalidatePath('/accounting', 'layout');
            return { success: true, message: 'Año fiscal eliminado.' };
        }
        return { success: false, message: 'Año fiscal no encontrado.' };
    } catch (error: any) {
        console.error('Error al eliminar año fiscal:', error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return { success: false, message: 'No se puede eliminar: el año fiscal tiene asientos contables asociados.' };
        }
        return { success: false, message: 'Error al eliminar año fiscal.' };
    }
}

export async function getCompanyAccountingSettings(): Promise<CompanyAccountingSettingsFormInput | null> {
    const companyInfo = await getCompanyInfoDetails();
    if (companyInfo) {
        return {
            currentFiscalYearId: companyInfo.currentFiscalYearId,
            retainedEarningsAccountId: companyInfo.retainedEarningsAccountId
        };
    }
    return null;
}

export async function updateCompanyAccountingSettings(data: CompanyAccountingSettingsFormInput): Promise<AccountingActionResponse<CompanyAccountingSettingsFormInput>> {
    const validatedFields = CompanyAccountingSettingsSchema.safeParse(data);
    if (!validatedFields.success) {
        return { success: false, message: "Error de validación", errors: validatedFields.error.flatten().fieldErrors };
    }
    if (!pool) return { success: false, message: "DB no disponible" };

    const { currentFiscalYearId, retainedEarningsAccountId } = validatedFields.data;
    try {
        // Validar que las IDs existan si no son null
        if (currentFiscalYearId) {
            const [fyRows] = await pool.query<RowDataPacket[]>('SELECT id FROM fiscal_years WHERE id = ? AND is_closed = FALSE', [currentFiscalYearId]);
            if (fyRows.length === 0) return { success: false, message: "Año fiscal activo seleccionado no es válido o está cerrado."};
        }
         if (retainedEarningsAccountId) {
            const [accRows] = await pool.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE id = ? AND type = "Patrimonio"', [retainedEarningsAccountId]);
            if (accRows.length === 0) return { success: false, message: "Cuenta de resultados acumulados seleccionada no es válida o no es de tipo Patrimonio."};
        }

        const [result] = await pool.query<ResultSetHeader>(
            'UPDATE company_info SET current_fiscal_year_id = ?, retained_earnings_account_id = ? WHERE id = 1',
            [currentFiscalYearId || null, retainedEarningsAccountId || null]
        );
        if (result.affectedRows > 0) {
            revalidatePath('/accounting', 'layout');
            return { success: true, message: "Configuración contable actualizada.", data: validatedFields.data };
        }
        return { success: false, message: "No se pudo actualizar la configuración." };
    } catch (error) {
        console.error("Error al actualizar configuración contable de la empresa:", error);
        return { success: false, message: "Error al actualizar configuración." };
    }
}


export async function closeFiscalYearProcess(): Promise<AccountingActionResponse<null>> {
    const session = await getSession();
    if (!session?.userId) {
        return { success: false, message: 'Usuario no autenticado para realizar el cierre.' };
    }
    const userId = parseInt(session.userId);

    if (!pool) return { success: false, message: 'DB no disponible.' };
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const activeFiscalYear = await getActiveFiscalYear(connection);
        if (!activeFiscalYear) {
            await connection.rollback();
            return { success: false, message: 'No hay un año fiscal activo configurado.' };
        }
        if (activeFiscalYear.isClosed) {
            await connection.rollback();
            return { success: false, message: `El año fiscal ${activeFiscalYear.name} ya está cerrado.` };
        }

        const retainedEarningsAccount = await getRetainedEarningsAccount(connection);
        if (!retainedEarningsAccount) {
            await connection.rollback();
            return { success: false, message: 'No se ha configurado una cuenta de Resultados Acumulados/Del Ejercicio en la configuración de la empresa.' };
        }

        const incomeStatementData = await generateIncomeStatement(activeFiscalYear.id);
        const netIncomeForYear = incomeStatementData.netIncome;
        const closingDate = activeFiscalYear.endDate;

        // Simplificación: Un solo asiento para transferir el resultado neto.
        // En un sistema completo, se cierran individualmente las cuentas de Ingreso y Gasto contra una cuenta puente "Pérdidas y Ganancias",
        // y luego el saldo de "Pérdidas y Ganancias" se transfiere a "Resultados Acumulados".
        // Esta simplificación asume que los saldos de Ingreso/Gasto en chart_of_accounts se pondrán a cero
        // y el netIncomeForYear se sumará a la cuenta de Resultados Acumulados.

        if (netIncomeForYear !== 0) {
            let debitCode, creditCode;
            if (netIncomeForYear > 0) { // Ganancia
                // Necesitamos encontrar una cuenta temporal de "Pérdidas y Ganancias" o debitar ingresos y acreditar gastos individualmente
                // Para esta simplificación, si hay ganancia, se DEBITA una cuenta de "Resumen de Ganancias y Pérdidas" (conceptual)
                // y se ACREDITA "Resultados Acumulados".
                // Dado que no tenemos una cuenta PyG explícita, vamos a simular el efecto:
                // Los ingresos (saldo acreedor) se debitan para cerrarlos.
                // Los gastos (saldo deudor) se acreditan para cerrarlos.
                // La diferencia se mueve a Resultados Acumulados.

                // Asiento para cerrar Ingresos (simulado)
                // Suma de todos los ingresos
                await addJournalEntry({
                    date: closingDate, description: `Cierre de Ingresos FY ${activeFiscalYear.name}`,
                    debitAccountCode: "TEMP_INGRESOS_CIERRE", // Código conceptual o real de cuenta de cierre de ingresos
                    creditAccountCode: retainedEarningsAccount.code,
                    amount: Math.abs(incomeStatementData.totalRevenues), fiscalYearId: activeFiscalYear.id, entryNumber: ''
                }, connection);

                // Asiento para cerrar Gastos (simulado)
                // Suma de todos los gastos
                 await addJournalEntry({
                    date: closingDate, description: `Cierre de Gastos FY ${activeFiscalYear.name}`,
                    debitAccountCode: retainedEarningsAccount.code,
                    creditAccountCode: "TEMP_GASTOS_CIERRE", // Código conceptual o real de cuenta de cierre de gastos
                    amount: Math.abs(incomeStatementData.totalExpenses), fiscalYearId: activeFiscalYear.id, entryNumber: ''
                }, connection);
                // La lógica de addJournalEntry ya actualiza los saldos en chart_of_accounts.
                // Aquí deberíamos poner a CERO los saldos de todas las cuentas de Ingreso y Gasto para el año.
                // Y actualizar el saldo de retainedEarningsAccount.
                // Esta es la parte más compleja que la simulación actual no maneja perfectamente sin afectar saldos acumulados.
            }
             // Aquí se requeriría actualizar los saldos de `chart_of_accounts` para Ingresos y Gastos a 0,
            // y sumar/restar el `netIncomeForYear` al saldo de `retainedEarningsAccount.id`.
            // Por ahora, `addJournalEntry` modifica esos saldos, pero un proceso de cierre real
            // es más que solo crear un asiento sumario.
        }


        await connection.query(
            'UPDATE fiscal_years SET is_closed = TRUE, closed_at = CURRENT_TIMESTAMP, closed_by_user_id = ? WHERE id = ?',
            [userId, activeFiscalYear.id]
        );
        
        // Actualizar el saldo de la cuenta de resultados acumulados explícitamente
        const [currentRetainedBalanceRows] = await connection.query<RowDataPacket[]>('SELECT balance FROM chart_of_accounts WHERE id = ?', [retainedEarningsAccount.id]);
        const newRetainedBalance = parseFloat(currentRetainedBalanceRows[0].balance) + netIncomeForYear;
        await connection.query('UPDATE chart_of_accounts SET balance = ? WHERE id = ?', [newRetainedBalance, retainedEarningsAccount.id]);

        // Poner a cero los saldos de las cuentas de Ingreso y Gasto (del año cerrado) en chart_of_accounts
        // Esto es importante si chart_of_accounts.balance se usa para saldos de apertura del siguiente año.
        const resultAccountsToZero = accounts.filter(acc => acc.type === 'Ingreso' || acc.type === 'Gasto');
        for (const acc of resultAccountsToZero) {
            await connection.query('UPDATE chart_of_accounts SET balance = 0.00 WHERE id = ?', [acc.id]);
        }


        await connection.commit();
        revalidatePath('/accounting', 'layout');
        return { success: true, message: `Año fiscal ${activeFiscalYear.name} cerrado exitosamente. El resultado de €${netIncomeForYear.toFixed(2)} ha sido transferido a ${retainedEarningsAccount.name}. Los saldos de Ingresos y Gastos han sido puestos a cero para este año.` };

    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error('Error en el proceso de cierre de año fiscal:', error);
        return { success: false, message: `Error al cerrar el año fiscal: ${error.message}` };
    } finally {
        if (connection) connection.release();
    }
}
