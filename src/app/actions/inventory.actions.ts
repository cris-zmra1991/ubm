
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Esquema para la validación de artículos de inventario
export const InventoryItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre del producto es requerido.'),
  sku: z.string().min(1, 'El SKU es requerido.'),
  category: z.string().min(1, 'La categoría es requerida.'),
  currentStock: z.coerce.number().int().min(0, 'El stock actual no puede ser negativo.'),
  reorderLevel: z.coerce.number().int().min(0, 'El nivel de pedido no puede ser negativo.'),
  unitPrice: z.coerce.number().positive('El precio unitario debe ser positivo.'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  supplier: z.string().optional(),
});

export type InventoryItemFormInput = z.infer<typeof InventoryItemSchema>;

export const AdjustStockSchema = z.object({
  itemId: z.string(),
  quantityChange: z.coerce.number().int('La cantidad debe ser un número entero.'),
  reason: z.string().min(1, 'Se requiere un motivo para el ajuste.'),
});
export type AdjustStockFormInput = z.infer<typeof AdjustStockSchema>;


export interface InventoryActionResponse {
  success: boolean;
  message: string;
  errors?: {
    name?: string[];
    sku?: string[];
    category?: string[];
    currentStock?: string[];
    reorderLevel?: string[];
    unitPrice?: string[];
    imageUrl?: string[];
    supplier?: string[];
    quantityChange?: string[]; // Para ajuste de stock
    reason?: string[]; // Para ajuste de stock
    general?: string[];
  };
  inventoryItem?: InventoryItemFormInput;
}

// Simulación de base de datos en memoria
let DUMMY_INVENTORY_DB: InventoryItemFormInput[] = [
  { id: "1", name: "Ratón Inalámbrico Pro", sku: "WM-PRO-001", category: "Electrónica", currentStock: 45, reorderLevel: 20, unitPrice: 29.99, imageUrl: "https://placehold.co/60x60.png?text=Mouse", supplier: "TechSupplies Ltd." },
  { id: "2", name: "Teclado Ergonómico", sku: "EK-BLK-005", category: "Electrónica", currentStock: 15, reorderLevel: 10, unitPrice: 79.50, imageUrl: "https://placehold.co/60x60.png?text=Keyboard", supplier: "OfficeComfort Inc." },
];
let nextInventoryId = 3;

export async function addInventoryItem(
  data: InventoryItemFormInput
): Promise<InventoryActionResponse> {
  const validatedFields = InventoryItemSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const newItem = { ...validatedFields.data, id: String(nextInventoryId++) };
    // TODO: Lógica para insertar en la base de datos MySQL
    DUMMY_INVENTORY_DB.push(newItem);
    console.log('Artículo de inventario añadido (simulado):', newItem);

    revalidatePath('/inventory');
    return {
      success: true,
      message: 'Artículo de inventario añadido exitosamente.',
      inventoryItem: newItem,
    };
  } catch (error) {
    console.error('Error al añadir artículo de inventario (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al añadir artículo.',
      errors: { general: ['No se pudo añadir el artículo al inventario.'] },
    };
  }
}

export async function updateInventoryItem(
  data: InventoryItemFormInput
): Promise<InventoryActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de artículo requerido para actualizar.' };
  }
  const validatedFields = InventoryItemSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    // TODO: Lógica para actualizar en la base de datos MySQL
    const index = DUMMY_INVENTORY_DB.findIndex(item => item.id === validatedFields.data.id);
    if (index === -1) {
      return { success: false, message: 'Artículo no encontrado.' };
    }
    DUMMY_INVENTORY_DB[index] = { ...DUMMY_INVENTORY_DB[index], ...validatedFields.data };
    console.log('Artículo de inventario actualizado (simulado):', DUMMY_INVENTORY_DB[index]);
    
    revalidatePath('/inventory');
    return {
      success: true,
      message: 'Artículo de inventario actualizado exitosamente.',
      inventoryItem: DUMMY_INVENTORY_DB[index],
    };
  } catch (error) {
    console.error('Error al actualizar artículo (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al actualizar artículo.',
      errors: { general: ['No se pudo actualizar el artículo.'] },
    };
  }
}

export async function deleteInventoryItem(
  itemId: string
): Promise<InventoryActionResponse> {
  if (!itemId) {
    return { success: false, message: 'ID de artículo requerido para eliminar.' };
  }

  try {
    // TODO: Lógica para eliminar de la base de datos MySQL
    const initialLength = DUMMY_INVENTORY_DB.length;
    DUMMY_INVENTORY_DB = DUMMY_INVENTORY_DB.filter(item => item.id !== itemId);
    
    if (DUMMY_INVENTORY_DB.length === initialLength) {
        return { success: false, message: 'Artículo no encontrado para eliminar.' };
    }
    console.log('Artículo de inventario eliminado (simulado), ID:', itemId);

    revalidatePath('/inventory');
    return {
      success: true,
      message: 'Artículo de inventario eliminado exitosamente.',
    };
  } catch (error) {
    console.error('Error al eliminar artículo (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar artículo.',
      errors: { general: ['No se pudo eliminar el artículo.'] },
    };
  }
}

export async function adjustStock(
  data: AdjustStockFormInput
): Promise<InventoryActionResponse> {
  const validatedFields = AdjustStockSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación del ajuste de stock.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { itemId, quantityChange, reason } = validatedFields.data;

  try {
    // TODO: Lógica para actualizar stock en la base de datos MySQL
    const index = DUMMY_INVENTORY_DB.findIndex(item => item.id === itemId);
    if (index === -1) {
      return { success: false, message: 'Artículo no encontrado para ajustar stock.' };
    }
    
    const newStock = DUMMY_INVENTORY_DB[index].currentStock + quantityChange;
    if (newStock < 0) {
      return { 
        success: false, 
        message: 'El ajuste resultaría en stock negativo.',
        errors: { quantityChange: ['El stock no puede ser menor que cero.'] }
      };
    }
    DUMMY_INVENTORY_DB[index].currentStock = newStock;
    console.log(`Stock ajustado para ${itemId} (simulado): ${quantityChange}. Motivo: ${reason}. Nuevo stock: ${newStock}`);
    
    revalidatePath('/inventory');
    return {
      success: true,
      message: 'Stock ajustado exitosamente.',
      inventoryItem: DUMMY_INVENTORY_DB[index],
    };
  } catch (error) {
    console.error('Error al ajustar stock (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al ajustar stock.',
      errors: { general: ['No se pudo ajustar el stock.'] },
    };
  }
}


// Función para obtener datos (simulada)
export async function getInventoryItems() {
  // TODO: Lógica para obtener Artículos de Inventario de la base de datos MySQL
  console.log('Obteniendo Artículos de Inventario (simulado)');
  return DUMMY_INVENTORY_DB;
}
