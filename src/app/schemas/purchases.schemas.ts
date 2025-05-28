
import { z } from 'zod';

export const PurchaseOrderItemSchema = z.object({
  inventoryItemId: z.string().min(1, 'Debe seleccionar un artículo.'),
  quantity: z.coerce.number().int().positive('La cantidad debe ser un número positivo.'),
  unitPrice: z.coerce.number().nonnegative('El precio unitario no puede ser negativo.'), // Precio al momento de la orden
});
export type PurchaseOrderItemFormInput = z.infer<typeof PurchaseOrderItemSchema>;


export const PurchaseOrderSchema = z.object({
  id: z.string().optional(),
  // poNumber ya no se ingresa, se genera automáticamente
  vendor: z.string().min(1, 'El proveedor es requerido.'),
  date: z.string().min(1, 'La fecha es requerida.'),
  // totalAmount se calculará a partir de los items
  status: z.enum(["Borrador", "Confirmada", "Enviada", "Recibida", "Cancelada"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
  items: z.array(PurchaseOrderItemSchema).min(1, "Debe añadir al menos un artículo a la orden."),
});
