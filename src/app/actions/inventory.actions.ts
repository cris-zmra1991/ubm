
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { InventoryItemSchema, AdjustStockSchema } from '@/app/schemas/inventory.schemas';

// TODO: SQL - CREATE TABLE para artículos de inventario
// CREATE TABLE inventory_items (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   name VARCHAR(255) NOT NULL,
//   sku VARCHAR(100) NOT NULL UNIQUE,
//   category VARCHAR(255) NOT NULL,
//   currentStock INT NOT NULL DEFAULT 0,
//   reorderLevel INT NOT NULL DEFAULT 0,
//   unitPrice DECIMAL(10, 2) NOT NULL,
//   imageUrl VARCHAR(2048),
//   supplier VARCHAR(255),
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

export type InventoryItemFormInput = z.infer<typeof InventoryItemSchema>;
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
    quantityChange?: string[]; 
    reason?: string[]; 
    general?: string[];
  };
  inventoryItem?: InventoryItemFormInput & { id: string };
}

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

  if (!pool) {
    console.error('Error: Connection pool not available in addInventoryItem.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  
  const { name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier } = validatedFields.data;

  try {
    // TODO: SQL - Insertar artículo de inventario
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO inventory_items (name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl || null, supplier || null]
    );

    if (result.affectedRows > 0) {
      const newItemId = result.insertId.toString();
      revalidatePath('/inventory');
      return {
        success: true,
        message: 'Artículo de inventario añadido exitosamente.',
        inventoryItem: { ...validatedFields.data, id: newItemId },
      };
    } else {
      return { success: false, message: 'No se pudo añadir el artículo al inventario.' };
    }
  } catch (error: any) {
    console.error('Error al añadir artículo de inventario (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) { // Manejar error de SKU duplicado
        return { success: false, message: 'Error: El SKU ya existe.', errors: { sku: ['Este SKU ya está registrado.'] } };
    }
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

  if (!pool) {
    console.error('Error: Connection pool not available in updateInventoryItem.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  
  const { id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier } = validatedFields.data;

  try {
    // TODO: SQL - Actualizar artículo de inventario
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE inventory_items SET name = ?, sku = ?, category = ?, currentStock = ?, reorderLevel = ?, unitPrice = ?, imageUrl = ?, supplier = ? WHERE id = ?',
      [name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl || null, supplier || null, id]
    );
    
    if (result.affectedRows > 0) {
      revalidatePath('/inventory');
      return {
        success: true,
        message: 'Artículo de inventario actualizado exitosamente.',
        inventoryItem: { ...validatedFields.data, id: id! },
      };
    } else {
      return { success: false, message: 'Artículo no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar artículo (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El SKU ya existe para otro artículo.', errors: { sku: ['Este SKU ya está registrado para otro artículo.'] } };
    }
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

  if (!pool) {
    console.error('Error: Connection pool not available in deleteInventoryItem.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  try {
    // TODO: SQL - Eliminar artículo de inventario
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM inventory_items WHERE id = ?',
      [itemId]
    );
    
    if (result.affectedRows > 0) {
        revalidatePath('/inventory');
        return {
          success: true,
          message: 'Artículo de inventario eliminado exitosamente.',
        };
    } else {
        return { success: false, message: 'Artículo no encontrado para eliminar.' };
    }
  } catch (error) {
    console.error('Error al eliminar artículo (MySQL):', error);
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

  if (!pool) {
    console.error('Error: Connection pool not available in adjustStock.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { itemId, quantityChange, reason } = validatedFields.data;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // TODO: SQL - Obtener stock actual y luego actualizarlo
    const [itemRows] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier FROM inventory_items WHERE id = ? FOR UPDATE',
      [itemId]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'Artículo no encontrado para ajustar stock.' };
    }
    
    const currentItem = itemRows[0] as InventoryItemFormInput;
    const newStock = Number(currentItem.currentStock) + quantityChange;

    if (newStock < 0) {
      await connection.rollback();
      return { 
        success: false, 
        message: 'El ajuste resultaría en stock negativo.',
        errors: { quantityChange: ['El stock no puede ser menor que cero.'] }
      };
    }

    await connection.query<ResultSetHeader>(
      'UPDATE inventory_items SET currentStock = ? WHERE id = ?',
      [newStock, itemId]
    );

    // TODO: SQL - Opcionalmente, registrar el ajuste en una tabla de historial de stock
    // Ejemplo: INSERT INTO stock_adjustments (itemId, quantityChange, reason, newStock, userId) VALUES (?, ?, ?, ?, ?);
    // Para este ejemplo, omitimos el historial pero es importante en un sistema real.
    console.log(`Stock ajustado para ${itemId}. Motivo: ${reason}. Nuevo stock: ${newStock}. Cambio: ${quantityChange}`);

    await connection.commit();
    
    revalidatePath('/inventory');
    return {
      success: true,
      message: 'Stock ajustado exitosamente.',
      inventoryItem: { ...currentItem, id: currentItem.id!.toString(), currentStock: newStock },
    };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al ajustar stock (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al ajustar stock.',
      errors: { general: ['No se pudo ajustar el stock.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}


export async function getInventoryItems(): Promise<InventoryItemFormInput[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getInventoryItems.');
    return [];
  }
  try {
    // TODO: SQL - Obtener artículos de inventario
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier FROM inventory_items ORDER BY name ASC'
    );
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
        currentStock: Number(row.currentStock),
        reorderLevel: Number(row.reorderLevel),
        unitPrice: parseFloat(row.unitPrice)
    })) as InventoryItemFormInput[];
  } catch (error) {
    console.error('Error al obtener Artículos de Inventario (MySQL):', error);
    return [];
  }
}
