
import { z } from 'zod';

export const PurchaseOrderSchema = z.object({
  id: z.string().optional(),
  poNumber: z.string().min(1, 'El número de OC es requerido.'),
  vendor: z.string().min(1, 'El proveedor es requerido.'),
  date: z.string().min(1, 'La fecha es requerida.'), 
  totalAmount: z.coerce.number().positive('El monto total debe ser positivo.'),
  status: z.enum(["Borrador", "Confirmada", "Enviada", "Recibida", "Cancelada"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
});
