
import { z } from 'zod';

export const AccountSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, 'El código de cuenta es requerido.'),
  name: z.string().min(1, 'El nombre de cuenta es requerido.'),
  type: z.enum(["Activo", "Pasivo", "Patrimonio", "Ingreso", "Gasto"], {
    errorMap: () => ({ message: 'Selecciona un tipo de cuenta válido.' }),
  }),
  balance: z.coerce.number().default(0),
});

export const JournalEntrySchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'La fecha es requerida.'), // Validar formato de fecha si es necesario
  entryNumber: z.string().min(1, 'El número de asiento es requerido.'),
  description: z.string().min(1, 'La descripción es requerida.'),
  debitAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de débito.'),
  creditAccountCode: z.string().min(1, 'Se requiere el código de la cuenta de crédito.'),
  amount: z.coerce.number().positive('El monto debe ser positivo.'),
});
