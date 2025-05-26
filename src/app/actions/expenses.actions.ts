
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Esquema para la validación de gastos
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
  receiptUrl: z.string().url().optional().or(z.literal('')), // opcional y puede ser string vacío
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
  expense?: ExpenseFormInput;
}

// Simulación de base de datos en memoria
let DUMMY_EXPENSES_DB: ExpenseFormInput[] = [
  { id: "1", date: "2024-07-01", category: "Suministros de Oficina", description: "Papel para impresora y bolígrafos", amount: 45.50, vendor: "Office Depot", status: "Pagado", receiptUrl: "#" },
  { id: "2", date: "2024-07-05", category: "Viajes", description: "Vuelo a conferencia", amount: 350.00, status: "Aprobado", vendor: "Aerolínea X" },
];
let nextExpenseId = 3;

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

  try {
    const newExpense = { ...validatedFields.data, id: String(nextExpenseId++) };
    // TODO: Lógica para insertar en la base de datos MySQL
    DUMMY_EXPENSES_DB.push(newExpense);
    console.log('Gasto añadido (simulado):', newExpense);

    revalidatePath('/expenses');
    return {
      success: true,
      message: 'Gasto añadido exitosamente.',
      expense: newExpense,
    };
  } catch (error) {
    console.error('Error al añadir gasto (simulado):', error);
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

  try {
    // TODO: Lógica para actualizar en la base de datos MySQL
    const index = DUMMY_EXPENSES_DB.findIndex(ex => ex.id === validatedFields.data.id);
    if (index === -1) {
      return { success: false, message: 'Gasto no encontrado.' };
    }
    DUMMY_EXPENSES_DB[index] = { ...DUMMY_EXPENSES_DB[index], ...validatedFields.data };
    console.log('Gasto actualizado (simulado):', DUMMY_EXPENSES_DB[index]);
    
    revalidatePath('/expenses');
    return {
      success: true,
      message: 'Gasto actualizado exitosamente.',
      expense: DUMMY_EXPENSES_DB[index],
    };
  } catch (error) {
    console.error('Error al actualizar gasto (simulado):', error);
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

  try {
    // TODO: Lógica para eliminar de la base de datos MySQL
    const initialLength = DUMMY_EXPENSES_DB.length;
    DUMMY_EXPENSES_DB = DUMMY_EXPENSES_DB.filter(ex => ex.id !== expenseId);
    
    if (DUMMY_EXPENSES_DB.length === initialLength) {
        return { success: false, message: 'Gasto no encontrado para eliminar.' };
    }
    console.log('Gasto eliminado (simulado), ID:', expenseId);

    revalidatePath('/expenses');
    return {
      success: true,
      message: 'Gasto eliminado exitosamente.',
    };
  } catch (error) {
    console.error('Error al eliminar gasto (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar gasto.',
      errors: { general: ['No se pudo eliminar el gasto.'] },
    };
  }
}

// Función para obtener datos (simulada)
export async function getExpenses() {
  // TODO: Lógica para obtener Gastos de la base de datos MySQL
  console.log('Obteniendo Gastos (simulado)');
  return DUMMY_EXPENSES_DB;
}

