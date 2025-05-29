
import { z } from 'zod';

export const PurchaseOrderItemSchema = z.object({
  inventoryItemId: z.string().min(1, 'Debe seleccionar un artículo.'),
  quantity: z.coerce.number().int().positive('La cantidad debe ser un número positivo.'),
  unitPrice: z.coerce.number().nonnegative('El precio unitario no puede ser negativo.'),
});
export type PurchaseOrderItemFormInput = z.infer<typeof PurchaseOrderItemSchema>;


export const PurchaseOrderSchema = z.object({
  id: z.string().optional(),
  vendorId: z.string().min(1, 'El proveedor es requerido.'),
  date: z.string().min(1, 'La fecha es requerida.'),
  description: z.string().min(1, 'La descripción es requerida.'), // Hecho obligatorio
  status: z.enum(["Borrador", "Confirmada", "Cancelada", "Pagado"], { // Estados actualizados
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
  items: z.array(PurchaseOrderItemSchema).min(1, "Debe añadir al menos un artículo a la orden."),
});
export type PurchaseOrderFormInput = z.infer<typeof PurchaseOrderSchema>;
