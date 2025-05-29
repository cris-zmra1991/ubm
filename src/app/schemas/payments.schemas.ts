
import { z } from 'zod';

export const PaymentSchema = z.object({
  id: z.string().optional(),
  // source_document_type y source_document_id se pasarán por separado
  paymentDate: z.string().min(1, 'La fecha de pago es requerida.'),
  amount: z.coerce.number().positive('El monto debe ser positivo.'),
  paymentMethod: z.string().min(1, 'El método de pago es requerido.'),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
