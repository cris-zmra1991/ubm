'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import { AccountSchema, JournalEntrySchema, FiscalYearSchema, CompanyAccountingSettingsSchema, type FiscalYearFormInput } from '../schemas/accounting.schemas';
import type { CompanyInfoFormInput } from '../schemas/admin.schemas';
import { getSession, type SessionPayload } from '@/lib/session';


export type AccountFormInput = z.infer<typeof AccountSchema>;
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;
export type CompanyAccountingSettingsFormInput = z.infer<typeof CompanyAccountingSettingsSchema>;


export interface AccountWithDetails extends AccountFormInput {
  id: string;
  parent_account_id?: string | null; // Este es el que viene de la BD
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

const NULL_PARENT_ACC_VALUE = "##NULL_PARENT_ACCOUNT_PLACEHOLDER##";
const NULL_ACTIVE_FY_VALUE = "##NULL_ACTIVE_FY_PLACEHOLDER##";
const NULL_RETAINED_ACC_VALUE = "##NULL_RETAINED_ACC_PLACEHOLDER##";


async function getCompanyInfoDetails(connection?: Connection): Promise<(CompanyInfoFormInput & {currentFiscalYearId?: number | null, retainedEarningsAccountId?: number | null}) | null> {
    const conn = connection || pool;
    if (!conn) return null;
    try {
        const [rows] = await conn.query<RowDataPacket[]>('SELECT *, current_fiscal_year_id as currentFiscalYearId, retained_earnings_account_id as retainedEarningsAccountId FROM company_info WHERE id = 1');
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
    const companyInfo = await getCompanyInfoDetails(conn);
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
    const companyInfo = await getCompanyInfoDetails(conn);
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

  let { code, name, type, balance, parentAccountId } = validatedFields.data;

  if (parentAccountId === NULL_PARENT_ACC_VALUE) {
    parentAccountId = null;
  }
  
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

  let { id, code, name, type, parentAccountId } = validatedFields.data;
  
  if (parentAccountId === NULL_PARENT_ACC_VALUE) {
    parentAccountId = null;
  }

  try {
    const parentIdValue = parentAccountId ? parseInt(parentAccountId) : null;

    if (id === parentAccountId) {
        return { success: false, message: 'Una cuenta no puede ser su propia cuenta padre.', errors: { parentAccountId: ['Selecciona una cuenta padre diferente.'] } };
    }

    // No actualizar el balance directamente desde aquí, solo con asientos o cierre.
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
      parent_account_id: row.parent_account_id?.toString() || null, // Asegurar que la propiedad que usa el map está
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

    // Función recursiva para calcular saldos acumulados
    function calculateRolledUpBalances(account: AccountWithDetails): number {
      let sumOfChildren = 0;
      if (account.children && account.children.length > 0) {
        for (const child of account.children) {
          sumOfChildren += calculateRolledUpBalances(child);
        }
      }
      // El rolledUpBalance de una cuenta es su propio balance MÁS la suma de los rolledUpBalances de sus hijos.
      account.rolledUpBalance = account.balance + sumOfChildren;
      return account.rolledUpBalance;
    }
    
    // Disparar el cálculo desde las cuentas raíz
    rootAccounts.forEach(calculateRolledUpBalances);
    
    // Actualizar todos los accounts en el mapa para reflejar los rolledUpBalances calculados.
    // Esto es un poco redundante si la recursión modifica los objetos originales en el mapa (lo cual hace).
    // Pero para estar seguros:
    accounts.forEach(acc => {
        if(accountMap.has(acc.id)) {
             const mappedAcc = accountMap.get(acc.id)!;
             if (mappedAcc.rolledUpBalance === undefined && acc.rolledUpBalance !== undefined) {
                 // Esto no debería suceder si la recursión funciona bien
                 mappedAcc.rolledUpBalance = acc.rolledUpBalance;
             } else if (mappedAcc.rolledUpBalance !== undefined) {
                 acc.rolledUpBalance = mappedAcc.rolledUpBalance;
             }
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

  let { date, description, debitAccountCode, creditAccountCode, amount, entryNumber, fiscalYearId } = validatedFields.data;
  
  try {
    if (!dbConnection) await conn.beginTransaction();

    if (!entryNumber || entryNumber.trim() === '') {
        entryNumber = await generateJournalEntryNumber(conn);
    }

    let fiscalYearIdToUse = fiscalYearId;
    if (fiscalYearIdToUse === undefined || fiscalYearIdToUse === null) { 
        const activeFiscalYear = await getActiveFiscalYear(conn);
        if (!activeFiscalYear || activeFiscalYear.isClosed) {
          if (!dbConnection) await conn.rollback();
          return { success: false, message: 'No hay un año fiscal activo abierto para registrar el asiento o el año fiscal activo está cerrado.' };
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

    if (debitAccountRows.length === 0) { if (!dbConnection) await conn.rollback(); return { success: false, message: `Cuenta de débito ${debitAccountCode} no existe.`}; }
    if (creditAccountRows.length === 0) { if (!dbConnection) await conn.rollback(); return { success: false, message: `Cuenta de crédito ${creditAccountCode} no existe.`}; }
    if (debitAccountCode === creditAccountCode) { if (!dbConnection) await conn.rollback(); return { success: false, message: 'Débito y crédito no pueden ser la misma cuenta.'}; }

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

export async function updateJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  console.warn("updateJournalEntry: La edición de asientos contables que afectan saldos es compleja y generalmente no se permite. Solo para datos descriptivos o asientos de reversión/corrección.");
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

  if (fiscalYearIdToQuery === undefined && fiscalYearIdInput !== null) { 
      const activeFiscalYear = await getActiveFiscalYear();
      if (activeFiscalYear) {
        fiscalYearIdToQuery = activeFiscalYear.id;
      } else if (fiscalYearIdInput === undefined) { 
         console.warn("getJournalEntries: No se especificó año fiscal y no hay uno activo. Se devolverán todos los asientos (podría ser lento).");
      } else { 
        return []; 
      }
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
      if (activeFiscalYear) {
        fiscalYearIdToQuery = activeFiscalYear.id;
      } else {
        console.warn("getAccountBalancesSummary: No fiscal year specified and no active one found. Totals will be global or zero if no entries.");
        return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 };
      }
  }

  try {
    
    let revenueQuery = "SELECT SUM(je.amount) as total FROM journal_entries je JOIN chart_of_accounts ca ON je.creditAccountCode = ca.code WHERE ca.type = 'Ingreso'";
    let expenseQuery = "SELECT SUM(je.amount) as total FROM journal_entries je JOIN chart_of_accounts ca ON je.debitAccountCode = ca.code WHERE ca.type = 'Gasto'";
    const queryParams: any[] = [];

    if (fiscalYearIdToQuery) {
      revenueQuery += " AND je.fiscal_year_id = ?";
      expenseQuery += " AND je.fiscal_year_id = ?";
      queryParams.push(fiscalYearIdToQuery); 
    } else {
      // Si no hay año fiscal para filtrar, los totales no serían significativos para un período.
      // Podrías devolver totales globales, pero el dashboard espera del año fiscal activo.
      console.warn("getAccountBalancesSummary: Fiscal year ID is null after attempting to find active one. Returning zero totals.");
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
      const [fyRows] = await pool.query<RowDataPacket[]>(
          'SELECT id, name, DATE_FORMAT(start_date, "%Y-%m-%d") as startDate, DATE_FORMAT(end_date, "%Y-%m-%d") as endDate, is_closed as isClosed FROM fiscal_years WHERE id = ?',
          [fiscalYearIdInput]
      );
      if (fyRows.length > 0) fiscalYearToQuery = { ...fyRows[0], isClosed: Boolean(fyRows[0].isClosed) } as FiscalYear;
  } else {
      fiscalYearToQuery = await getActiveFiscalYear();
  }

  if (!fiscalYearToQuery) throw new Error("Año fiscal no especificado o no encontrado para el Balance General.");
  const reportDate = fiscalYearToQuery.endDate;

  try {
    const allAccounts = await getAccounts(); // Esto ya calcula rolledUpBalance correctamente

    const assets = allAccounts.filter(acc => acc.type === 'Activo' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));
    const liabilities = allAccounts.filter(acc => acc.type === 'Pasivo' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));
    const equityAccounts = allAccounts.filter(acc => acc.type === 'Patrimonio' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));

    // Los rolledUpBalance ya deberían tener el signo correcto (positivo para todos si se usa Dr+/Cr+)
    const totalAssets = assets.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    let totalEquityFromAccounts = equityAccounts.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    
    let netIncomeForPeriod = 0;
    if (!fiscalYearToQuery.isClosed) {
        const incomeStatementData = await generateIncomeStatement(fiscalYearToQuery.id);
        netIncomeForPeriod = incomeStatementData.netIncome;
    }
    
    // El patrimonio total es el patrimonio de las cuentas de balance más el resultado del ejercicio (si no está cerrado)
    const finalTotalEquity = totalEquityFromAccounts + netIncomeForPeriod;
    
    return {
      assets,
      liabilities,
      equity: equityAccounts, // Se listan las cuentas de patrimonio, su suma es totalEquityFromAccounts
      totalAssets,
      totalLiabilities, // Ya no se usa Math.abs()
      totalEquity: finalTotalEquity, // Ya no se usa Math.abs() y se usa la variable actualizada
      totalLiabilitiesAndEquity: totalLiabilities + finalTotalEquity,
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
    const allAccounts = await getAccounts(); // Para obtener detalles de las cuentas
    const accountMap = new Map(allAccounts.map(acc => [acc.code, acc]));

    const revenueQuery = `
      SELECT ca.code, ca.name, ca.id, SUM(je.amount) as period_total 
      FROM journal_entries je 
      JOIN chart_of_accounts ca ON je.creditAccountCode = ca.code 
      WHERE ca.type = 'Ingreso' AND je.fiscal_year_id = ? 
      GROUP BY ca.code, ca.name, ca.id ORDER BY ca.code`;
      
    const expenseQuery = `
      SELECT ca.code, ca.name, ca.id, SUM(je.amount) as period_total 
      FROM journal_entries je 
      JOIN chart_of_accounts ca ON je.debitAccountCode = ca.code 
      WHERE ca.type = 'Gasto' AND je.fiscal_year_id = ? 
      GROUP BY ca.code, ca.name, ca.id ORDER BY ca.code`;
    
    const queryParams = [fiscalYearToQuery.id];

    const [revenueRows] = await pool.query<RowDataPacket[]>(revenueQuery, queryParams);
    const [expenseRows] = await pool.query<RowDataPacket[]>(expenseQuery, queryParams);

    const revenues: AccountWithDetails[] = revenueRows.map(r => ({
        ...(accountMap.get(r.code) || { id: r.id.toString(), code: r.code, name: r.name, type: 'Ingreso', balance: 0, parentAccountId: null }),
        balance: parseFloat(r.period_total) || 0, // Aquí 'balance' representa el total del período para esta cuenta de resultados
        rolledUpBalance: parseFloat(r.period_total) || 0 // Para consistencia, aunque no se usa para 'enrollar' en E.R.
    }));
    const expenses: AccountWithDetails[] = expenseRows.map(e => ({
        ...(accountMap.get(e.code) || { id: e.id.toString(), code: e.code, name: e.name, type: 'Gasto', balance: 0, parentAccountId: null }),
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

  if (!fiscalYearToQuery) {
    console.warn("getIncomeVsExpenseChartData: No fiscal year specified or active. Returning empty data.");
    return [];
  }


  try {
    const query = `
      SELECT
        DATE_FORMAT(je.date, '%Y-%m') AS entry_month,
        SUM(CASE WHEN ca_credit.type = 'Ingreso' THEN je.amount ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN ca_debit.type = 'Gasto' THEN je.amount ELSE 0 END) AS total_expenses
      FROM journal_entries je
      LEFT JOIN chart_of_accounts ca_debit ON je.debitAccountCode = ca_debit.code
      LEFT JOIN chart_of_accounts ca_credit ON je.creditAccountCode = ca_credit.code
      WHERE je.fiscal_year_id = ? 
      GROUP BY entry_month
      ORDER BY entry_month DESC 
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
    }).sort((a, b) => { 
      const [aMonthName, aYear] = a.month.split(" ");
      const [bMonthName, bYear] = b.month.split(" ");
      const aDate = new Date(`20${aYear}-${monthNames.indexOf(aMonthName)+1}-01`);
      const bDate = new Date(`20${bYear}-${monthNames.indexOf(bMonthName)+1}-01`);
      return aDate.getTime() - bDate.getTime();
    });
  } catch (error) {
    console.error('Error al obtener datos para gráfico Ingresos vs Gastos (MySQL):', error);
    return [];
  }
}


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
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO fiscal_years (name, start_date, end_date) VALUES (?, ?, ?)',
      [name, startDate, endDate]
    );
    if (result.insertId) {
      revalidatePath('/accounting', 'layout');
      return { success: true, message: 'Año fiscal añadido.', data: { ...validatedFields.data, id: result.insertId, isClosed: false } };
    }
    return { success: false, message: 'No se pudo añadir el año fiscal.' };
  } catch (error: any) {
    console.error('Error detallado al añadir año fiscal (MySQL):', error);
     if (error.code === 'ER_DUP_ENTRY' && error.message && error.message.includes('name_UNIQUE')) {
        return { success: false, message: 'Error: Ya existe un año fiscal con ese nombre.', errors: { name: ['Este nombre ya está en uso.'] } };
    }
    return { success: false, message: 'Error al añadir año fiscal: ' + (error.message || 'Error desconocido.') };
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
      return { success: true, message: 'Año fiscal actualizado.', data: { ...validatedFields.data, id, isClosed: false } };
    }
    return { success: false, message: 'Año fiscal no encontrado o sin cambios.' };
  } catch (error: any) { 
    console.error('Error al actualizar año fiscal (MySQL):', error.message);
    if (error.code === 'ER_DUP_ENTRY' && error.message && error.message.includes('name_UNIQUE')) {
        return { success: false, message: 'Error: Ya existe un año fiscal con ese nombre.', errors: { name: ['Este nombre ya está en uso.'] } };
    }
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
        if (error.code === 'ER_ROW_IS_REFERENCED_2' || (error.message && error.message.includes('CONSTRAINT `journal_entries_ibfk_1`'))) { 
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

    let { currentFiscalYearId, retainedEarningsAccountId } = validatedFields.data;

    try {
        if (currentFiscalYearId) {
            const [fyRows] = await pool.query<RowDataPacket[]>('SELECT id FROM fiscal_years WHERE id = ? AND is_closed = FALSE', [currentFiscalYearId]);
            if (fyRows.length === 0) return { success: false, message: "Año fiscal activo seleccionado no es válido o está cerrado."};
        }
         if (retainedEarningsAccountId) {
            const [accRows] = await pool.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE id = ? AND type = "Patrimonio"', [retainedEarningsAccountId]);
            if (accRows.length === 0) return { success: false, message: "Cuenta de resultados acumulados seleccionada no es válida o no es de tipo Patrimonio."};
        }

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO company_info (id, current_fiscal_year_id, retained_earnings_account_id) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE current_fiscal_year_id = VALUES(current_fiscal_year_id), retained_earnings_account_id = VALUES(retained_earnings_account_id)',
            [currentFiscalYearId || null, retainedEarningsAccountId || null]
        );

        if (result.affectedRows > 0 || result.insertId) {
            revalidatePath('/accounting', 'layout');
            return { success: true, message: "Configuración contable actualizada.", data: validatedFields.data };
        }
        return { success: false, message: "No se pudo actualizar la configuración." };
    } catch (error: any) {
        console.error("Error al actualizar configuración contable de la empresa:", error);
        return { success: false, message: "Error al actualizar configuración: " + error.message };
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
            return { success: false, message: 'No se ha configurado una cuenta de Resultados Acumulados en la configuración de la empresa.' };
        }

        // Obtener los movimientos de ingresos y gastos del período
        const incomeStatementData = await generateIncomeStatement(activeFiscalYear.id); 
        const closingDate = activeFiscalYear.endDate;

        // Cerrar cuentas de Ingreso contra Resultados Acumulados
        for (const revenueAcc of incomeStatementData.revenues) {
            if (revenueAcc.balance !== 0) { 
                const closingAmount = Math.abs(revenueAcc.balance); // Ingresos tienen saldo acreedor, se debitan para cerrar.
                const entryResult = await addJournalEntry({
                    date: closingDate, description: `Cierre Ingresos FY ${activeFiscalYear.name}: ${revenueAcc.name}`,
                    debitAccountCode: revenueAcc.code, 
                    creditAccountCode: retainedEarningsAccount.code, 
                    amount: closingAmount,
                    fiscalYearId: activeFiscalYear.id, entryNumber: '' // entryNumber se autogenerará
                }, connection);
                if (!entryResult.success) throw new Error(entryResult.message || "Error al generar asiento de cierre de ingresos.");
            }
        }

        // Cerrar cuentas de Gasto contra Resultados Acumulados
        for (const expenseAcc of incomeStatementData.expenses) {
             if (expenseAcc.balance !== 0) { 
                const closingAmount = Math.abs(expenseAcc.balance); // Gastos tienen saldo deudor, se acreditan para cerrar.
                const entryResult = await addJournalEntry({
                    date: closingDate, description: `Cierre Gastos FY ${activeFiscalYear.name}: ${expenseAcc.name}`,
                    debitAccountCode: retainedEarningsAccount.code, 
                    creditAccountCode: expenseAcc.code, 
                    amount: closingAmount, 
                    fiscalYearId: activeFiscalYear.id, entryNumber: ''
                }, connection);
                 if (!entryResult.success) throw new Error(entryResult.message || "Error al generar asiento de cierre de gastos.");
            }
        }
        
        // Marcar el año fiscal como cerrado
        await connection.query(
            'UPDATE fiscal_years SET is_closed = TRUE, closed_at = CURRENT_TIMESTAMP, closed_by_user_id = ? WHERE id = ?',
            [userId, activeFiscalYear.id]
        );
        
        await connection.commit();
        revalidatePath('/accounting', 'layout');
        return { success: true, message: `Año fiscal ${activeFiscalYear.name} cerrado exitosamente. El resultado de €${incomeStatementData.netIncome.toFixed(2)} ha sido transferido a ${retainedEarningsAccount.name}. Los saldos de Ingresos y Gastos para este año han sido cerrados.` };

    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error('Error en el proceso de cierre de año fiscal:', error);
        return { success: false, message: `Error al cerrar el año fiscal: ${error.message}` };
    } finally {
        if (connection) connection.release();
    }
}