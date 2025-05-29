
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

// TODO: SQL - CREATE TABLE chart_of_accounts (id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, type ENUM('Activo', 'Pasivo', 'Patrimonio', 'Ingreso', 'Gasto') NOT NULL, balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00, parent_account_id INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (parent_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL);
// TODO: SQL - CREATE TABLE journal_entries (id INT AUTO_INCREMENT PRIMARY KEY, date DATE NOT NULL, entryNumber VARCHAR(100) NOT NULL UNIQUE, description TEXT NOT NULL, debitAccountCode VARCHAR(50) NOT NULL, creditAccountCode VARCHAR(50) NOT NULL, amount DECIMAL(15, 2) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (debitAccountCode) REFERENCES chart_of_accounts(code), FOREIGN KEY (creditAccountCode) REFERENCES chart_of_accounts(code));

async function generateJournalEntryNumber(connection: Connection): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  // TODO: SQL - Esta forma de generar secuenciales puede tener problemas de concurrencia en sistemas de alto tráfico.
  // Considerar una secuencia de BD, una tabla de contadores dedicada, o un UUID si la secuencia estricta no es vital.
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

    // TODO: SQL - INSERT INTO chart_of_accounts (code, name, type, balance, parent_account_id) VALUES (?, ?, ?, ?, ?)
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
        return { success: false, message: 'Una cuenta no puede ser su propia cuenta padre.', errors: { parentAccountId: ['Selecciona una cuenta padre diferente.'] } };
    }

    // TODO: SQL - UPDATE chart_of_accounts SET code = ?, name = ?, type = ?, parent_account_id = ? WHERE id = ?
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

    // TODO: SQL - SELECT id FROM chart_of_accounts WHERE parent_account_id = ?
    const [childrenRows] = await connection.query<RowDataPacket[]>('SELECT id FROM chart_of_accounts WHERE parent_account_id = ?', [parseInt(accountId)]);
    if (childrenRows.length > 0) {
      await connection.rollback();
      return { success: false, message: 'No se puede eliminar: la cuenta tiene cuentas hijas asignadas. Reasigna o elimina las cuentas hijas primero.' };
    }
    // TODO: SQL - Considerar verificar si la cuenta tiene asientos en journal_entries antes de eliminar.
    // TODO: SQL - DELETE FROM chart_of_accounts WHERE id = ?
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
    // TODO: SQL - SELECT id, code, name, type, balance, parent_account_id FROM chart_of_accounts ORDER BY code ASC
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
      let sum = account.balance; // Saldo directo de la cuenta
      if (account.children && account.children.length > 0) {
        for (const child of account.children) {
          sum += calculateRolledUpBalances(child); // Sumar el saldo acumulado de las hijas
        }
      }
      account.rolledUpBalance = sum;
      return sum;
    }
    rootAccounts.forEach(calculateRolledUpBalances); // Calcula para las cuentas raíz, que recursivamente calculará para todas
    
    // Para devolver la lista plana pero con rolledUpBalance calculado para todas:
    // Se actualiza el mapa después del cálculo para que todas las cuentas en 'accounts' tengan el rolledUpBalance.
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
  dbConnection?: Connection // Permite usar una transacción existente
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

  try {
    if (!dbConnection) await conn.beginTransaction(); // Iniciar transacción solo si no se pasó una conexión

    if (!entryNumber || entryNumber.trim() === '') { // Generar número si está vacío
        entryNumber = await generateJournalEntryNumber(conn);
    }

    // Verificar que las cuentas existan
    const [debitAccountRows] = await conn.query<RowDataPacket[]>('SELECT id, type, balance FROM chart_of_accounts WHERE code = ?', [debitAccountCode]);
    const [creditAccountRows] = await conn.query<RowDataPacket[]>('SELECT id, type, balance FROM chart_of_accounts WHERE code = ?', [creditAccountCode]);

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
    // TODO: SQL - INSERT INTO journal_entries (date, entryNumber, description, debitAccountCode, creditAccountCode, amount) VALUES (?, ?, ?, ?, ?, ?)
    const [result] = await conn.query<ResultSetHeader>(
      'INSERT INTO journal_entries (date, entryNumber, description, debitAccountCode, creditAccountCode, amount) VALUES (?, ?, ?, ?, ?, ?)',
      [date, entryNumber, description, debitAccountCode, creditAccountCode, numericAmount]
    );

    // Actualizar saldos de las cuentas
    // Para la cuenta de débito:
    if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(debitAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, debitAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(debitAccountType)) { // Si se debita una cuenta que aumenta con crédito, su saldo disminuye
        await conn.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, debitAccountCode]);
    }

    // Para la cuenta de crédito:
    if (ACCOUNT_TYPES_INCREASE_WITH_CREDIT.includes(creditAccountType)) {
        await conn.query('UPDATE chart_of_accounts SET balance = balance + ? WHERE code = ?', [numericAmount, creditAccountCode]);
    } else if (ACCOUNT_TYPES_INCREASE_WITH_DEBIT.includes(creditAccountType)) { // Si se acredita una cuenta que aumenta con débito, su saldo disminuye
        await conn.query('UPDATE chart_of_accounts SET balance = balance - ? WHERE code = ?', [numericAmount, creditAccountCode]);
    }

    if (!dbConnection) await conn.commit(); // Confirmar transacción solo si no se pasó una conexión

    if (result.affectedRows > 0) {
      const newEntryId = result.insertId.toString();
      revalidatePath('/accounting', 'layout');
      revalidatePath('/', 'layout'); 
      return { success: true, message: 'Asiento contable añadido.', data: { ...validatedFields.data, id: newEntryId, entryNumber } };
    } else {
      return { success: false, message: 'No se pudo añadir el asiento.' };
    }
  } catch (error: any) {
    if (!dbConnection && conn) await conn.rollback(); // Revertir transacción en caso de error si no se pasó una conexión
    console.error('Error al añadir asiento (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' && error.message.includes('entryNumber')) {
        return { success: false, message: 'Error: El número de asiento ya existe.', errors: { entryNumber: ['Este número ya está registrado. Intenta de nuevo.'] } };
    }
    return { success: false, message: 'Error al añadir asiento.', errors: { general: ['Error del servidor al procesar el asiento.'] } };
  } finally {
    if (!dbConnection && conn && pool) (conn as Connection).release(); // Liberar conexión solo si no se pasó una
  }
}

export async function updateJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  // ADVERTENCIA: La edición de asientos contables es compleja.
  // Normalmente, se realizan asientos de reversión o ajuste en lugar de modificar directamente.
  // Esta función actualiza los datos descriptivos, pero NO recalcula saldos ni revierte el asiento original.
  if (!data.id) return { success: false, message: 'ID de asiento requerido.' };
  console.warn("updateJournalEntry: Actualización no afecta saldos de cuentas. Solo para corrección de datos descriptivos del asiento como fecha o descripción.");

  const validatedFields = JournalEntrySchema.safeParse(data);
   if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id, date, entryNumber, description /*, debitAccountCode, creditAccountCode, amount */ } = validatedFields.data;
  // Por seguridad, no permitir cambiar cuentas o monto desde una edición simple.
  // TODO: SQL - UPDATE journal_entries SET date = ?, entryNumber = ?, description = ? /*, debitAccountCode = ?, creditAccountCode = ?, amount = ? */ WHERE id = ?
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE journal_entries SET date = ?, entryNumber = ?, description = ? WHERE id = ?',
      [date, entryNumber, description, parseInt(id)]
    );

    if (result.affectedRows > 0) {
        revalidatePath('/accounting', 'layout');
        return { success: true, message: 'Asiento actualizado (solo datos descriptivos).', data: { ...validatedFields.data, id: id! } };
    } else {
        return { success: false, message: 'Asiento no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar asiento (MySQL):', error);
    return { success: false, message: 'Error al actualizar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteJournalEntry(entryId: string): Promise<AccountingActionResponse<null>> {
   // ADVERTENCIA: La eliminación de asientos contables es peligrosa y puede desbalancear la contabilidad.
   // Normalmente, se realizan asientos de reversión.
   // Esta función elimina el asiento, pero NO revierte el impacto en los saldos de las cuentas.
   if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  console.warn("deleteJournalEntry: Eliminación no revierte impacto en saldos de cuentas.");
  try {
    // TODO: SQL - DELETE FROM journal_entries WHERE id = ?
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

export async function getJournalEntries(): Promise<(JournalEntryFormInput & { id: string })[]> {
  if (!pool) { return []; }
  try {
    // TODO: SQL - SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, entryNumber, description, debitAccountCode, creditAccountCode, amount FROM journal_entries ORDER BY date DESC, entryNumber DESC
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
    // TODO: SQL - SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Ingreso'
    const [revenueRows] = await pool.query<RowDataPacket[]>("SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Ingreso'");
    // TODO: SQL - SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Gasto'
    const [expenseRows] = await pool.query<RowDataPacket[]>("SELECT SUM(balance) as total FROM chart_of_accounts WHERE type = 'Gasto'");

    // Los ingresos tienen saldo natural Acreedor (negativo en este sistema si Activos/Gastos son positivos). Tomamos el absoluto.
    const totalRevenue = revenueRows[0]?.total ? Math.abs(parseFloat(revenueRows[0].total)) : 0;
    // Los gastos tienen saldo natural Deudor (positivo).
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
}

export async function generateBalanceSheet(): Promise<BalanceSheetData> {
  if (!pool) throw new Error('DB no disponible.');
  try {
    const allAccounts = await getAccounts(); // Esta función ya calcula rolledUpBalance para la jerarquía
    
    const assets = allAccounts.filter(acc => acc.type === 'Activo' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));
    const liabilities = allAccounts.filter(acc => acc.type === 'Pasivo' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));
    const equity = allAccounts.filter(acc => acc.type === 'Patrimonio' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));

    // Usar rolledUpBalance para los totales de las categorías principales
    const totalAssets = assets.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    // Para Pasivos y Patrimonio, sus saldos naturales son Acreedores.
    // Si rolledUpBalance los tiene negativos (consistente con Ingresos), tomamos el absoluto para presentación.
    const totalLiabilities = liabilities.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    const totalEquity = equity.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);
    
    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities: Math.abs(totalLiabilities), 
      totalEquity: Math.abs(totalEquity), 
      totalLiabilitiesAndEquity: Math.abs(totalLiabilities) + Math.abs(totalEquity)
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
}

export async function generateIncomeStatement(): Promise<IncomeStatementData> {
  if (!pool) throw new Error('DB no disponible.');
  try {
    const allAccounts = await getAccounts();

    const revenues = allAccounts.filter(acc => acc.type === 'Ingreso' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));
    const expenses = allAccounts.filter(acc => acc.type === 'Gasto' && (!acc.parentAccountId || !allAccounts.find(p => p.id === acc.parentAccountId)));

    // Ingresos (saldo natural Acreedor). rolledUpBalance será negativo si es consistente. Tomamos absoluto.
    const totalRevenues = revenues.reduce((sum, acc) => sum + Math.abs(acc.rolledUpBalance ?? 0), 0);
    // Gastos (saldo natural Deudor). rolledUpBalance será positivo.
    const totalExpenses = expenses.reduce((sum, acc) => sum + (acc.rolledUpBalance ?? 0), 0);

    return {
      revenues,
      expenses,
      totalRevenues,
      totalExpenses,
      netIncome: totalRevenues - totalExpenses,
    };
  } catch (error) {
    console.error('Error al generar Estado de Resultados (MySQL):', error);
    throw error;
  }
}

export interface MonthlyIncomeExpense {
  month: string; // YYYY-MM
  revenue: number;
  expenses: number;
}

export async function getIncomeVsExpenseChartData(months: number = 6): Promise<MonthlyIncomeExpense[]> {
  if (!pool) {
    return [];
  }
  try {
    // TODO: SQL - Esta consulta es un ejemplo y necesitará ajustes para agrupar por mes correctamente.
    // Se basa en que 'journal_entries' y 'chart_of_accounts' están bien pobladas.
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT
        DATE_FORMAT(je.date, '%Y-%m') AS month,
        SUM(CASE WHEN ca.type = 'Ingreso' THEN je.amount ELSE 0 END) AS monthly_revenue,
        SUM(CASE WHEN ca.type = 'Gasto' THEN je.amount ELSE 0 END) AS monthly_expenses
      FROM journal_entries je
      JOIN chart_of_accounts ca_debit ON je.debitAccountCode = ca_debit.code
      JOIN chart_of_accounts ca_credit ON je.creditAccountCode = ca_credit.code
      WHERE je.date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
        AND (ca_debit.type IN ('Ingreso', 'Gasto') OR ca_credit.type IN ('Ingreso', 'Gasto')) 
        -- ^ Esta condición es un poco simplista, un asiento de ingreso es Dr:CuentasPorCobrar Cr:Ingreso
        -- Un asiento de gasto es Dr:Gasto Cr:CuentasPorPagar.
        -- La suma de 'je.amount' debe considerar si la cuenta de Ingreso/Gasto está en el débito o crédito.
        -- Para Ingresos (Crédito), el 'amount' del asiento es el ingreso.
        -- Para Gastos (Débito), el 'amount' del asiento es el gasto.
      GROUP BY month
      ORDER BY month ASC
      LIMIT ?;
    `, [months, months]);
    
    // La consulta anterior es un borrador. Una forma más precisa sería:
    // Sumar 'je.amount' si 'ca_credit.type' = 'Ingreso' para ingresos.
    // Sumar 'je.amount' si 'ca_debit.type' = 'Gasto' para gastos.

    const [refinedRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        DATE_FORMAT(je.date, '%Y-%m') AS entry_month,
        SUM(CASE WHEN ca_credit.type = 'Ingreso' THEN je.amount ELSE 0 END) AS total_revenue,
        SUM(CASE WHEN ca_debit.type = 'Gasto' THEN je.amount ELSE 0 END) AS total_expenses
      FROM journal_entries je
      LEFT JOIN chart_of_accounts ca_debit ON je.debitAccountCode = ca_debit.code
      LEFT JOIN chart_of_accounts ca_credit ON je.creditAccountCode = ca_credit.code
      WHERE je.date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      GROUP BY entry_month
      ORDER BY entry_month ASC
      LIMIT ?;
    `, [months, months]);


    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    
    return refinedRows.map(row => {
        const [year, monthNum] = (row.entry_month as string).split('-');
        return {
            month: `${monthNames[parseInt(monthNum) - 1]} ${year}`, // Formato más legible para el chart
            revenue: parseFloat(row.total_revenue) || 0,
            expenses: parseFloat(row.total_expenses) || 0,
        };
    });

  } catch (error) {
    console.error('Error al obtener datos para gráfico Ingresos vs Gastos (MySQL):', error);
    return [];
  }
}
