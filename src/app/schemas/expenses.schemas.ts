
import { z } from 'zod';

export const ExpenseSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, 'La fecha es requerida.'),
  category: z.string().min(1, 'La categoría es requerida.'),
  description: z.string().min(1, 'La descripción es requerida.'),
  amount: z.coerce.number().positive('El monto debe ser positivo.'),
  vendor: z.string().optional().nullable(),
  status: z.enum(["Enviado", "Aprobado", "Rechazado", "Pagado"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
  receiptUrl: z.string().url({ message: "URL de recibo inválida." }).optional().or(z.literal('')),
});
