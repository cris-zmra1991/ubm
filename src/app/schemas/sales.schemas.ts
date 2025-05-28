
import { z } from 'zod';

export const SaleOrderItemSchema = z.object({
  inventoryItemId: z.string().min(1, 'Debe seleccionar un artículo.'),
  quantity: z.coerce.number().int().positive('La cantidad debe ser un número positivo.'),
  unitPrice: z.coerce.number().nonnegative('El precio unitario no puede ser negativo.'), // Precio al momento de la venta
});
export type SaleOrderItemFormInput = z.infer<typeof SaleOrderItemSchema>;

export const SaleOrderSchema = z.object({
  id: z.string().optional(),
  // invoiceNumber se genera automáticamente
  customerId: z.string().min(1, 'El cliente es requerido.'), // Cambiado de customer a customerId
  date: z.string().min(1, 'La fecha es requerida.'),
  // totalAmount se calculará a partir de los items
  status: z.enum(["Borrador", "Confirmada", "Enviada", "Entregada", "Pagada", "Cancelada"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
  items: z.array(SaleOrderItemSchema).min(1, "Debe añadir al menos un artículo a la orden."),
});
export type SaleOrderFormInput = z.infer<typeof SaleOrderSchema>;

    