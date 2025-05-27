
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

// SQL - CREATE TABLE para gastos
// CREATE TABLE expenses (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   date DATE NOT NULL,
//   category VARCHAR(255) NOT NULL,
//   description TEXT NOT NULL,
//   amount DECIMAL(10, 2) NOT NULL,
//   vendor VARCHAR(255),
//   status ENUM('Enviado', 'Aprobado', 'Rechazado', 'Pagado') NOT NULL,
//   receiptUrl VARCHAR(2048), -- URL al recibo
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

export const ExpenseSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'La fecha es requerida.'),
  category: z.string().min(1, 'La categoría es requerida.'),
  description: z.string().min(1, 'La descripción es requerida.'),
  amount: z.coerce.number().positive('El monto debe ser positivo.'),
  vendor: z.string().optional(),
  status: z.enum(["Enviado", "Aprobado", "Rechazado", "Pagado"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
  receiptUrl: z.string().url({ message: "URL de recibo inválida." }).optional().or(z.literal('')),
});

export type ExpenseFormInput = z.infer<typeof ExpenseSchema>;

export interface ExpenseActionResponse {
  success: boolean;
  message: string;
  errors?: {
    date?: string[];
    category?: string[];
    description?: string[];
    amount?: string[];
    vendor?: string[];
    status?: string[];
    receiptUrl?: string[];
    general?: string[];
  };
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
    console.error('Error: Connection pool not available in addExpense.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { date, category, description, amount, vendor, status, receiptUrl } = validatedFields.data;

  try {
    // SQL - Insertar gasto
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO expenses (date, category, description, amount, vendor, status, receiptUrl) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [date, category, description, amount, vendor || null, status, receiptUrl || null]
    );

    if (result.affectedRows > 0) {
      const newExpenseId = result.insertId.toString();
      revalidatePath('/expenses');
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
    console.error('Error: Connection pool not available in updateExpense.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  
  const { id, date, category, description, amount, vendor, status, receiptUrl } = validatedFields.data;

  try {
    // SQL - Actualizar gasto
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE expenses SET date = ?, category = ?, description = ?, amount = ?, vendor = ?, status = ?, receiptUrl = ? WHERE id = ?',
      [date, category, description, amount, vendor || null, status, receiptUrl || null, id]
    );
    
    if (result.affectedRows > 0) {
      revalidatePath('/expenses');
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
    console.error('Error: Connection pool not available in deleteExpense.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  try {
    // SQL - Eliminar gasto
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM expenses WHERE id = ?',
      [expenseId]
    );
    
    if (result.affectedRows > 0) {
        revalidatePath('/expenses');
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

export async function getExpenses(): Promise<ExpenseFormInput[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getExpenses.');
    return [];
  }
  try {
    // SQL - Obtener gastos
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, category, description, amount, vendor, status, receiptUrl FROM expenses ORDER BY date DESC'
    );
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
        amount: parseFloat(row.amount)
    })) as ExpenseFormInput[];
  } catch (error) {
    console.error('Error al obtener Gastos (MySQL):', error);
    return [];
  }
}

export async function getExpensesLastMonthValue(): Promise<number> {
  if (!pool) {
    console.error('Error: Connection pool not available in getExpensesLastMonthValue.');
    return 0;
  }
  try {
    // SQL - Obtener suma de gastos pagados del último mes (ej. últimos 30 días)
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(amount) as total FROM expenses WHERE status = 'Pagado' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
    );
    if (rows.length > 0 && rows[0].total) {
      return parseFloat(rows[0].total);
    }
    return 0;
  } catch (error) {
    console.error('Error al obtener valor de gastos del último mes (MySQL):', error);
    return 0;
  }
}
