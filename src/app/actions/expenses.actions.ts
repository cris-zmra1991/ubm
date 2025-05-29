
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import { ExpenseSchema } from '@/app/schemas/expenses.schemas';
import { addJournalEntry } from './accounting.actions';

export type ExpenseFormInput = z.infer<typeof ExpenseSchema>;

export interface ExpenseActionResponse {
  success: boolean;
  message: string;
  errors?: any;
  expense?: ExpenseFormInput & { id: string };
}

// TODO: SQL - CREATE TABLE expenses ( id INT AUTO_INCREMENT PRIMARY KEY, date DATE NOT NULL, category VARCHAR(255) NOT NULL, description TEXT NOT NULL, amount DECIMAL(10, 2) NOT NULL, vendor VARCHAR(255), status ENUM('Borrador', 'Confirmada', 'Cancelada', 'Pagado') NOT NULL, receiptUrl VARCHAR(2048), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP );

export async function addExpense(
  data: ExpenseFormInput
): Promise<ExpenseActionResponse> {
  const validatedFields = ExpenseSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { date, category, description, amount, vendor, status, receiptUrl } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      'INSERT INTO expenses (date, category, description, amount, vendor, status, receiptUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [date, category, description, amount, vendor || null, status, receiptUrl || null]
    );
    const newExpenseId = result.insertId;

    if (newExpenseId <= 0) {
        await connection.rollback();
        return { success: false, message: 'No se pudo añadir el gasto.'};
    }

    if (status === 'Confirmada') {
      // TODO: SQL - Necesitarás una cuenta de "Gasto" predeterminada o una forma de seleccionarla.
      // Por ahora, usaremos un placeholder. También una cuenta de "Cuentas por Pagar" o "Caja/Banco" si se paga directamente.
      // Asumimos que un gasto confirmado crea una obligación de pago (Cuentas por Pagar).
      const DEFAULT_EXPENSE_ACCOUNT_CODE = "6.1.01"; // Placeholder para cuenta de gasto general
      const DEFAULT_ACCOUNTS_PAYABLE_FOR_EXPENSE_CODE = "2.1.02"; // Placeholder para Cuentas por Pagar - Gastos

      const journalEntryDesc = `Gasto ${category}: ${description}`;
      await addJournalEntry({
          date,
          entryNumber: '',
          description: journalEntryDesc,
          debitAccountCode: DEFAULT_EXPENSE_ACCOUNT_CODE, // Dr: Gasto
          creditAccountCode: DEFAULT_ACCOUNTS_PAYABLE_FOR_EXPENSE_CODE, // Cr: Cuentas por Pagar (o Caja/Banco si se paga al instante)
          amount
      }, connection);
    }
    
    await connection.commit();

    revalidatePath('/expenses', 'layout');
    if (status === 'Confirmada') {
        revalidatePath('/accounting', 'layout');
        revalidatePath('/payments', 'layout');
    }
    return {
      success: true,
      message: 'Gasto añadido exitosamente.',
      expense: { ...validatedFields.data, id: newExpenseId.toString() },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir gasto (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al añadir gasto.',
      errors: { general: ['No se pudo añadir el gasto.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function updateExpense(
  data: ExpenseFormInput
): Promise<ExpenseActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de gasto requerido para actualizar.' };
  }
  const validatedFields = ExpenseSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id, date, category, description, amount, vendor, status, receiptUrl } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [currentExpenseRows] = await connection.query<RowDataPacket[]>('SELECT status FROM expenses WHERE id = ?', [parseInt(id)]);
    if (currentExpenseRows.length === 0) {
        await connection.rollback();
        return { success: false, message: 'Gasto no encontrado.' };
    }
    const oldStatus = currentExpenseRows[0].status;

    if (oldStatus === 'Pagado' && status !== 'Pagado') {
      await connection.rollback();
      return { success: false, message: 'No se puede cambiar el estado de un gasto ya pagado.' };
    }
    if (status === 'Pagado') { // No permitir cambiar a Pagado desde aquí
      await connection.rollback();
      return { success: false, message: 'El estado "Pagado" solo se puede establecer desde el módulo de Pagos.' };
    }
    if (oldStatus === 'Confirmada' && status === 'Borrador') {
        await connection.rollback();
        return { success: false, message: 'No se puede revertir un gasto confirmado a borrador. Considere cancelarlo.' };
    }
     if (oldStatus === 'Cancelada' && status !== 'Cancelada') {
         await connection.rollback();
        return { success: false, message: 'No se puede cambiar el estado de un gasto cancelado.' };
    }


    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, vendor = ?, status = ?, receiptUrl = ? WHERE id = ?',
      [date, category, description, amount, vendor || null, status, receiptUrl || null, parseInt(id)]
    );

    const becameConfirmed = status === 'Confirmada' && oldStatus === 'Borrador';
    if (becameConfirmed) {
      // Generar asiento contable al confirmar si antes era borrador
      const DEFAULT_EXPENSE_ACCOUNT_CODE = "6.1.01"; 
      const DEFAULT_ACCOUNTS_PAYABLE_FOR_EXPENSE_CODE = "2.1.02";
      const journalEntryDesc = `Gasto ${category}: ${description}`;
      await addJournalEntry({
          date, entryNumber: '', description: journalEntryDesc,
          debitAccountCode: DEFAULT_EXPENSE_ACCOUNT_CODE,
          creditAccountCode: DEFAULT_ACCOUNTS_PAYABLE_FOR_EXPENSE_CODE,
          amount
      }, connection);
    }
    
    await connection.commit();

    revalidatePath('/expenses', 'layout');
    if (becameConfirmed) {
        revalidatePath('/accounting', 'layout');
        revalidatePath('/payments', 'layout');
    }
    if (status === 'Cancelada' && oldStatus === 'Confirmada') {
        // TODO: Considerar revertir asiento contable.
        revalidatePath('/accounting', 'layout');
        revalidatePath('/payments', 'layout'); // Quitar de pagos pendientes
    }

    return {
      success: true,
      message: 'Gasto actualizado exitosamente.',
      expense: { ...validatedFields.data, id: id! },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al actualizar gasto (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al actualizar gasto.',
      errors: { general: ['No se pudo actualizar el gasto.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function deleteExpense(
  expenseId: string
): Promise<ExpenseActionResponse> {
  if (!expenseId) {
    return { success: false, message: 'ID de gasto requerido para eliminar.' };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  let connection: Connection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [expenseRows] = await connection.query<RowDataPacket[]>('SELECT status FROM expenses WHERE id = ?', [parseInt(expenseId)]);
    if (expenseRows.length === 0) {
        await connection.rollback();
        return { success: false, message: 'Gasto no encontrado.' };
    }
    const currentStatus = expenseRows[0].status;
    if (!['Borrador', 'Cancelada'].includes(currentStatus)) {
        await connection.rollback();
        return { success: false, message: `No se puede eliminar un gasto en estado '${currentStatus}'.` };
    }

    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM expenses WHERE id = ?',
      [parseInt(expenseId)]
    );
    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/expenses', 'layout');
        revalidatePath('/payments', 'layout'); 
        return {
          success: true,
          message: 'Gasto eliminado exitosamente.',
        };
    } else {
        return { success: false, message: 'Gasto no encontrado para eliminar.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al eliminar gasto (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar gasto.',
      errors: { general: ['No se pudo eliminar el gasto.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function getExpenses(): Promise<(ExpenseFormInput & {id: string})[]> {
  if (!pool) { return []; }
  try {
    // TODO: SQL - SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, category, description, amount, vendor, status, receiptUrl FROM expenses ORDER BY date DESC
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, category, description, amount, vendor, status, receiptUrl FROM expenses ORDER BY date DESC'
    );
    return rows.map(row => ({
        id: row.id.toString(),
        date: row.date,
        category: row.category,
        description: row.description,
        amount: parseFloat(row.amount),
        vendor: row.vendor,
        status: row.status,
        receiptUrl: row.receiptUrl
    })) as (ExpenseFormInput & {id: string})[];
  } catch (error) {
    console.error('Error al obtener Gastos (MySQL):', error);
    return [];
  }
}

export async function getExpensesLastMonthValue(): Promise<number> {
  if (!pool) { return 0; }
  try {
    // TODO: SQL - SELECT SUM(amount) as total FROM expenses WHERE status = 'Pagado' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(amount) as total FROM expenses WHERE status = 'Pagado' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
    );
    return rows.length > 0 && rows[0].total ? parseFloat(rows[0].total) : 0;
  } catch (error) {
    console.error('Error al obtener valor de gastos del último mes (MySQL):', error);
    return 0;
  }
}

export async function updateExpenseStatus(id: string, status: ExpenseFormInput["status"], dbConnection?: Connection): Promise<boolean> {
  const conn = dbConnection || await pool.getConnection();
  if (!conn) return false;

  try {
    if (!dbConnection) await conn.beginTransaction();
    // TODO: SQL - UPDATE expenses SET status = ? WHERE id = ?
    const [result] = await conn.query<ResultSetHeader>(
      'UPDATE expenses SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );

    if (!dbConnection) await conn.commit();
    if (result.affectedRows > 0) {
      revalidatePath('/expenses', 'layout');
      if (status === 'Confirmada' || status === 'Pagado') revalidatePath('/payments', 'layout');
      return true;
    }
    return false;
  } catch (error) {
    if (!dbConnection && conn) await conn.rollback();
    console.error(`Error al actualizar estado de gasto ${id} a ${status}:`, error);
    return false;
  } finally {
     if (!dbConnection && conn && pool && typeof (conn as Connection).release === 'function') {
        (conn as Connection).release();
    }
  }
}
