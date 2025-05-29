
import { z } from 'zod';

export const InventoryItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre del producto es requerido.'),
  sku: z.string().min(1, 'El SKU es requerido.'),
  category: z.string().min(1, 'La categoría es requerida.'),
  currentStock: z.coerce.number().int().min(0, 'El stock actual no puede ser negativo.'),
  reorderLevel: z.coerce.number().int().min(0, 'El nivel de pedido no puede ser negativo.'),
  unitPrice: z.coerce.number().positive('El precio unitario (costo) debe ser positivo.'),
  imageUrl: z.string().url({ message: "URL de imagen inválida." }).optional().or(z.literal('')),
  supplier: z.string().optional().nullable(),
  defaultDebitAccountId: z.string().nullable().optional().default(null)
    .describe("ID de la cuenta de Activo (Inventario) o COGS"),
  defaultCreditAccountId: z.string().nullable().optional().default(null)
    .describe("ID de la cuenta de Ingreso por Venta"),
  feePercentage: z.coerce.number().min(0).max(1000).nullable().optional()
    .describe("Porcentaje de ganancia sobre el costo (opcional)"),
  salePrice: z.coerce.number().positive('El precio de venta debe ser positivo.').nullable().optional()
    .describe("Precio de venta directo al público. Si se deja vacío y hay fee, se autocalcula."),
});

export const AdjustStockSchema = z.object({
  itemId: z.string().min(1, 'ID de artículo requerido.'),
  quantityChange: z.coerce.number().int('La cantidad debe ser un número entero.'),
  reason: z.string().min(1, 'Se requiere un motivo para el ajuste.'),
});
