
import { z } from 'zod';

export const InventoryItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre del producto es requerido.'),
  sku: z.string().min(1, 'El SKU es requerido.'),
  category: z.string().min(1, 'La categoría es requerida.'),
  currentStock: z.coerce.number().int().min(0, 'El stock actual no puede ser negativo.'),
  reorderLevel: z.coerce.number().int().min(0, 'El nivel de pedido no puede ser negativo.'),
  unitPrice: z.coerce.number().positive('El precio unitario debe ser positivo.'),
  imageUrl: z.string().url({ message: "URL de imagen inválida." }).optional().or(z.literal('')),
  supplier: z.string().optional(),
});

export const AdjustStockSchema = z.object({
  itemId: z.string().min(1, 'ID de artículo requerido.'),
  quantityChange: z.coerce.number().int('La cantidad debe ser un número entero.'), // Puede ser positivo o negativo
  reason: z.string().min(1, 'Se requiere un motivo para el ajuste.'),
});
