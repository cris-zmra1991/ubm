
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Esquema para Cuentas Contables
export const AccountSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'El código de cuenta es requerido.'),
  name: z.string().min(1, 'El nombre de cuenta es requerido.'),
  type: z.enum(["Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto"], {
    errorMap: () => ({ message: 'Selecciona un tipo de cuenta válido.' }),
  }),
  balance: z.coerce.number().default(0), // El balance inicial puede ser 0
});
export type AccountFormInput = z.infer<typeof AccountSchema>;

// Esquema para Asientos Contables
export const JournalEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'La fecha es requerida.'),
  entryNumber: z.string().min(1, 'El número de asiento es requerido.'),
  description: z.string().min(1, 'La descripción es requerida.'),
  debitAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de débito.'),
  creditAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de crédito.'),
  amount: z.coerce.number().positive('El monto debe ser positivo.'),
});
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;


export interface AccountingActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any; // Simplificado para el ejemplo, idealmente sería específico
  data?: T;
}

// Simulación de base de datos en memoria para Plan de Cuentas
let DUMMY_CHART_OF_ACCOUNTS_DB: AccountFormInput[] = [
  { id: "1", code: "1010", name: "Efectivo", type: "Activo", balance: 25000.75 },
  { id: "2", code: "1200", name: "Cuentas por Cobrar", type: "Activo", balance: 12500.00 },
];
let nextAccountId = 3;

// Simulación de base de datos en memoria para Asientos Contables
let DUMMY_JOURNAL_ENTRIES_DB: JournalEntryFormInput[] = [
 { id: "1", date: "2024-07-01", entryNumber: "JE-001", description: "Venta en efectivo", debitAccountCode: "1010", creditAccountCode: "4010", amount: 500.00 },
];
let nextJournalEntryId = 2;

// --- Acciones para Plan de Cuentas ---
export async function addAccount(
  data: AccountFormInput
): Promise<AccountingActionResponse<AccountFormInput>> {
  const validatedFields = AccountSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  try {
    const newAccount = { ...validatedFields.data, id: String(nextAccountId++) };
    // TODO: Lógica para insertar cuenta en MySQL
    DUMMY_CHART_OF_ACCOUNTS_DB.push(newAccount);
    revalidatePath('/accounting', 'layout'); // Revalidar toda la página de contabilidad
    return { success: true, message: 'Cuenta añadida exitosamente.', data: newAccount };
  } catch (error) {
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
  try {
    // TODO: Lógica para actualizar cuenta en MySQL
    const index = DUMMY_CHART_OF_ACCOUNTS_DB.findIndex(acc => acc.id === data.id);
    if (index === -1) return { success: false, message: 'Cuenta no encontrada.' };
    DUMMY_CHART_OF_ACCOUNTS_DB[index] = { ...DUMMY_CHART_OF_ACCOUNTS_DB[index], ...data };
    revalidatePath('/accounting', 'layout');
    return { success: true, message: 'Cuenta actualizada.', data: DUMMY_CHART_OF_ACCOUNTS_DB[index] };
  } catch (error) {
    return { success: false, message: 'Error al actualizar cuenta.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteAccount(accountId: string): Promise<AccountingActionResponse<null>> {
  try {
    // TODO: Lógica para eliminar cuenta en MySQL
    // Considerar validaciones: no eliminar si tiene asientos asociados, etc.
    DUMMY_CHART_OF_ACCOUNTS_DB = DUMMY_CHART_OF_ACCOUNTS_DB.filter(acc => acc.id !== accountId);
    revalidatePath('/accounting', 'layout');
    return { success: true, message: 'Cuenta eliminada.' };
  } catch (error) {
    return { success: false, message: 'Error al eliminar cuenta.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getAccounts(): Promise<AccountFormInput[]> {
  // TODO: Lógica para obtener cuentas de MySQL
  return DUMMY_CHART_OF_ACCOUNTS_DB;
}

// --- Acciones para Asientos Contables ---
export async function addJournalEntry(
  data: JournalEntryFormInput
): Promise<AccountingActionResponse<JournalEntryFormInput>> {
  const validatedFields = JournalEntrySchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  try {
    // TODO: Lógica para insertar asiento en MySQL
    // TODO: Validar que las cuentas de débito/crédito existan
    // TODO: Actualizar saldos de cuentas afectadas
    const newEntry = { ...validatedFields.data, id: String(nextJournalEntryId++) };
    DUMMY_JOURNAL_ENTRIES_DB.push(newEntry);
    revalidatePath('/accounting', 'layout');
    return { success: true, message: 'Asiento contable añadido.', data: newEntry };
  } catch (error) {
    return { success: false, message: 'Error al añadir asiento.', errors: { general: ['Error del servidor.'] } };
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
  try {
    // TODO: Lógica para actualizar asiento en MySQL
    // TODO: Revertir saldos antiguos y aplicar nuevos si las cuentas/monto cambian
    const index = DUMMY_JOURNAL_ENTRIES_DB.findIndex(je => je.id === data.id);
    if (index === -1) return { success: false, message: 'Asiento no encontrado.' };
    DUMMY_JOURNAL_ENTRIES_DB[index] = { ...DUMMY_JOURNAL_ENTRIES_DB[index], ...data };
    revalidatePath('/accounting', 'layout');
    return { success: true, message: 'Asiento actualizado.', data: DUMMY_JOURNAL_ENTRIES_DB[index] };
  } catch (error) {
    return { success: false, message: 'Error al actualizar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteJournalEntry(entryId: string): Promise<AccountingActionResponse<null>> {
   try {
    // TODO: Lógica para eliminar asiento en MySQL
    // TODO: Revertir saldos de cuentas afectadas
    DUMMY_JOURNAL_ENTRIES_DB = DUMMY_JOURNAL_ENTRIES_DB.filter(je => je.id !== entryId);
    revalidatePath('/accounting', 'layout');
    return { success: true, message: 'Asiento eliminado.' };
  } catch (error) {
    return { success: false, message: 'Error al eliminar asiento.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getJournalEntries(): Promise<JournalEntryFormInput[]> {
  // TODO: Lógica para obtener asientos de MySQL
  return DUMMY_JOURNAL_ENTRIES_DB;
}
