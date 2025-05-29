
import { z } from 'zod';

export const AccountSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'El código de cuenta es requerido.'),
  name: z.string().min(1, 'El nombre de cuenta es requerido.'),
  type: z.enum(["Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto"], {
    errorMap: () => ({ message: 'Selecciona un tipo de cuenta válido.' }),
  }),
  balance: z.coerce.number().default(0),
  parentAccountId: z.string().nullable().optional().default(null),
});
export type AccountFormInput = z.infer<typeof AccountSchema>;


export const JournalEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'La fecha es requerida.'),
  entryNumber: z.string().optional(), // Será autogenerado si se deja vacío
  description: z.string().min(1, 'La descripción es requerida.'),
  debitAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de débito.'),
  creditAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de crédito.'),
  amount: z.coerce.number().positive('El monto debe ser positivo.'),
  fiscalYearId: z.number().int().optional().nullable(),
});
export type JournalEntryFormInput = z.infer<typeof JournalEntrySchema>;

export const FiscalYearSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  startDate: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "Fecha de inicio inválida.",
  }),
  endDate: z.string().refine((date) => !isNaN(new Date(date).getTime()), {
    message: "Fecha de fin inválida.",
  }),
  isClosed: z.boolean().default(false),
}).refine(data => new Date(data.endDate) > new Date(data.startDate), {
    message: "La fecha de fin debe ser posterior a la fecha de inicio.",
    path: ["endDate"],
});
export type FiscalYearFormInput = z.infer<typeof FiscalYearSchema>;

export const CompanyAccountingSettingsSchema = z.object({
    currentFiscalYearId: z.coerce.number().int().nullable().optional(),
    retainedEarningsAccountId: z.coerce.number().int().nullable().optional(),
});
export type CompanyAccountingSettingsFormInput = z.infer<typeof CompanyAccountingSettingsSchema>;
