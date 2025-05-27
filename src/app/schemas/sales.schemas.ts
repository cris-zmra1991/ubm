
import { z } from 'zod';

export const SaleOrderSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1, 'El número de factura es requerido.'),
  customer: z.string().min(1, 'El cliente es requerido.'),
  date: z.string().min(1, 'La fecha es requerida.'),
  totalAmount: z.coerce.number().positive('El monto total debe ser positivo.'),
  status: z.enum(["Borrador", "Confirmada", "Enviada", "Entregada", "Pagada", "Cancelada"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
});
