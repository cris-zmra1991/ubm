
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import { ExpenseSchema } from '@/app/schemas/expenses.schemas';

// SQL - CREATE TABLE para gastos (asegúrate que status ENUM incluya 'Pagado')
// CREATE TABLE expenses ( id INT AUTO_INCREMENT PRIMARY KEY, date DATE NOT NULL, category VARCHAR(255) NOT NULL, description TEXT NOT NULL, amount DECIMAL(10, 2) NOT NULL, vendor VARCHAR(255), status ENUM('Enviado', 'Aprobado', 'Rechazado', 'Pagado') NOT NULL, receiptUrl VARCHAR(2048), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP );

export type ExpenseFormInput = z.infer<typeof ExpenseSchema>;

export interface ExpenseActionResponse {
  success: boolean;
  message: string;
  errors?: any;
  expense?: ExpenseFormInput & { id: string };
}

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

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO expenses (date, category, description, amount, vendor, status, receiptUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [date, category, description, amount, vendor || null, status, receiptUrl || null]
    );

    if (result.affectedRows > 0) {
      const newExpenseId = result.insertId.toString();
      revalidatePath('/expenses', 'layout');
      if (status === 'Aprobado') revalidatePath('/payments', 'layout');
      return {
        success: true,
        message: 'Gasto añadido exitosamente.',
        expense: { ...validatedFields.data, id: newExpenseId },
      };
    } else {
      return { success: false, message: 'No se pudo añadir el gasto.'};
    }
  } catch (error) {
    console.error('Error al añadir gasto (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al añadir gasto.',
      errors: { general: ['No se pudo añadir el gasto.'] },
    };
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

  try {
    const [currentExpense] = await pool.query<RowDataPacket[]>('SELECT status FROM expenses WHERE id = ?', [parseInt(id)]);
    const oldStatus = currentExpense.length > 0 ? currentExpense[0].status : null;

    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, vendor = ?, status = ?, receiptUrl = ? WHERE id = ?',
      [date, category, description, amount, vendor || null, status, receiptUrl || null, parseInt(id)]
    );

    if (result.affectedRows > 0) {
      revalidatePath('/expenses', 'layout');
      if (status === 'Aprobado' || oldStatus === 'Aprobado' || status === 'Pagado' || oldStatus === 'Pagado') {
          revalidatePath('/payments', 'layout');
      }
      return {
        success: true,
        message: 'Gasto actualizado exitosamente.',
        expense: { ...validatedFields.data, id: id! },
      };
    } else {
      return { success: false, message: 'Gasto no encontrado o sin cambios.' };
    }
  } catch (error) {
    console.error('Error al actualizar gasto (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al actualizar gasto.',
      errors: { general: ['No se pudo actualizar el gasto.'] },
    };
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

  try {
    // TODO: Considerar si se deben revertir asientos contables si el gasto estaba pagado o aprobado.
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM expenses WHERE id = ?',
      [parseInt(expenseId)]
    );

    if (result.affectedRows > 0) {
        revalidatePath('/expenses', 'layout');
        revalidatePath('/payments', 'layout'); // Siempre revalidar pagos por si estaba pendiente
        return {
          success: true,
          message: 'Gasto eliminado exitosamente.',
        };
    } else {
        return { success: false, message: 'Gasto no encontrado para eliminar.' };
    }
  } catch (error) {
    console.error('Error al eliminar gasto (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar gasto.',
      errors: { general: ['No se pudo eliminar el gasto.'] },
    };
  }
}

export async function getExpenses(): Promise<(ExpenseFormInput & {id: string})[]> {
  if (!pool) { return []; }
  try {
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

    const [result] = await conn.query<ResultSetHeader>(
      'UPDATE expenses SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );

    // TODO: Si el estado es 'Aprobado', generar asiento contable (Gasto vs Cuentas por Pagar).
    // La lógica del asiento para 'Pagado' ya está en processPayment.

    if (!dbConnection) await conn.commit();
    return result.affectedRows > 0;
  } catch (error) {
    if (!dbConnection && conn) await conn.rollback();
    console.error(`Error al actualizar estado de gasto ${id} a ${status}:`, error);
    return false;
  } finally {
     if (!dbConnection && conn && pool) (conn as Connection).release();
  }
}
