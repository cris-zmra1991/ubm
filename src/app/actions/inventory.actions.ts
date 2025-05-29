
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { InventoryItemSchema, AdjustStockSchema } from '@/app/schemas/inventory.schemas';

// TODO: SQL - CREATE TABLE inventory_items (... default_debit_account_id INT NULL, default_credit_account_id INT NULL, fee_percentage DECIMAL(5,2) NULL, sale_price DECIMAL(10,2) NULL, FOREIGN KEY (default_debit_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL, FOREIGN KEY (default_credit_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL);

export type InventoryItemFormInput = z.infer<typeof InventoryItemSchema>;
export type AdjustStockFormInput = z.infer<typeof AdjustStockSchema>;


export interface InventoryActionResponse {
  success: boolean;
  message: string;
  errors?: any;
  inventoryItem?: InventoryItemFormInput & { id: string };
}

export async function addInventoryItem(
  data: InventoryItemFormInput
): Promise<InventoryActionResponse> {
  const validatedFields = InventoryItemSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false, message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  
  const { name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, defaultDebitAccountId, defaultCreditAccountId, feePercentage, salePrice } = validatedFields.data;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO inventory_items (name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, default_debit_account_id, default_credit_account_id, fee_percentage, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl || null, supplier || null, defaultDebitAccountId || null, defaultCreditAccountId || null, feePercentage, salePrice]
    );

    if (result.affectedRows > 0) {
      const newItemId = result.insertId.toString();
      revalidatePath('/inventory');
      return {
        success: true, message: 'Artículo de inventario añadido.',
        inventoryItem: { ...validatedFields.data, id: newItemId },
      };
    } else {
      return { success: false, message: 'No se pudo añadir el artículo.' };
    }
  } catch (error: any) {
    console.error('Error al añadir artículo (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El SKU ya existe.', errors: { sku: ['Este SKU ya está registrado.'] } };
    }
    return {
      success: false, message: 'Error del servidor al añadir artículo.',
      errors: { general: ['No se pudo añadir el artículo.'] },
    };
  }
}

export async function updateInventoryItem(
  data: InventoryItemFormInput
): Promise<InventoryActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de artículo requerido.' };
  }
  const validatedFields = InventoryItemSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false, message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  
  const { id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, defaultDebitAccountId, defaultCreditAccountId, feePercentage, salePrice } = validatedFields.data;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE inventory_items SET name = ?, sku = ?, category = ?, currentStock = ?, reorderLevel = ?, unitPrice = ?, imageUrl = ?, supplier = ?, default_debit_account_id = ?, default_credit_account_id = ?, fee_percentage = ?, sale_price = ? WHERE id = ?',
      [name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl || null, supplier || null, defaultDebitAccountId || null, defaultCreditAccountId || null, feePercentage, salePrice, parseInt(id)]
    );
    
    if (result.affectedRows > 0) {
      revalidatePath('/inventory');
      return {
        success: true, message: 'Artículo de inventario actualizado.',
        inventoryItem: { ...validatedFields.data, id: id! },
      };
    } else {
      return { success: false, message: 'Artículo no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar artículo (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El SKU ya existe para otro artículo.', errors: { sku: ['Este SKU ya está registrado.'] } };
    }
    return {
      success: false, message: 'Error del servidor al actualizar.',
      errors: { general: ['No se pudo actualizar.'] },
    };
  }
}

export async function deleteInventoryItem(
  itemId: string
): Promise<InventoryActionResponse> {
  if (!itemId) {
    return { success: false, message: 'ID de artículo requerido.' };
  }
  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM inventory_items WHERE id = ?',
      [parseInt(itemId)]
    );
    
    if (result.affectedRows > 0) {
        revalidatePath('/inventory');
        return {
          success: true, message: 'Artículo de inventario eliminado.',
        };
    } else {
        return { success: false, message: 'Artículo no encontrado.' };
    }
  } catch (error: any)
   {
    console.error('Error al eliminar artículo (MySQL):', error);
     if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return { success: false, message: 'No se puede eliminar el artículo porque está referenciado en órdenes de compra o venta.'};
    }
    return {
      success: false, message: 'Error del servidor al eliminar.',
      errors: { general: ['No se pudo eliminar.'] },
    };
  }
}

export async function adjustStock(
  data: AdjustStockFormInput
): Promise<InventoryActionResponse> {
  const validatedFields = AdjustStockSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      success: false, message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { itemId, quantityChange, reason } = validatedFields.data;
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [itemRows] = await connection.query<RowDataPacket[]>(
      'SELECT id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, default_debit_account_id, default_credit_account_id, fee_percentage, sale_price FROM inventory_items WHERE id = ? FOR UPDATE',
      [parseInt(itemId)]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'Artículo no encontrado.' };
    }
    
    const currentItem = itemRows[0] as InventoryItemFormInput;
    const newStock = Number(currentItem.currentStock) + quantityChange;

    if (newStock < 0) {
      await connection.rollback();
      return { 
        success: false, message: 'El ajuste resultaría en stock negativo.',
        errors: { quantityChange: ['El stock no puede ser menor que cero.'] }
      };
    }

    await connection.query<ResultSetHeader>(
      'UPDATE inventory_items SET currentStock = ? WHERE id = ?',
      [newStock, parseInt(itemId)]
    );
    
    // TODO: Registrar el ajuste en una tabla de historial de stock (stock_adjustments_log)
    // INSERT INTO stock_adjustments_log (inventory_item_id, quantity_change, reason, new_stock, user_id) VALUES (?, ?, ?, ?, ?);
    
    await connection.commit();
    
    revalidatePath('/inventory');
    return {
      success: true, message: 'Stock ajustado exitosamente.',
      inventoryItem: { ...currentItem, id: currentItem.id!.toString(), currentStock: newStock },
    };
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al ajustar stock (MySQL):', error);
    return {
      success: false, message: 'Error del servidor al ajustar stock.',
      errors: { general: ['No se pudo ajustar el stock.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}


export async function getInventoryItems(): Promise<(InventoryItemFormInput & {id: string})[]> {
  if (!pool) {
    return [];
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, default_debit_account_id, default_credit_account_id, fee_percentage, sale_price FROM inventory_items ORDER BY name ASC'
    );
    return rows.map(row => ({
        id: row.id.toString(),
        name: row.name,
        sku: row.sku,
        category: row.category,
        currentStock: Number(row.currentStock),
        reorderLevel: Number(row.reorderLevel),
        unitPrice: parseFloat(row.unitPrice),
        imageUrl: row.imageUrl,
        supplier: row.supplier,
        defaultDebitAccountId: row.default_debit_account_id?.toString() || null,
        defaultCreditAccountId: row.default_credit_account_id?.toString() || null,
        feePercentage: row.fee_percentage !== null ? parseFloat(row.fee_percentage) : null,
        salePrice: row.sale_price !== null ? parseFloat(row.sale_price) : null,
    })) as (InventoryItemFormInput & {id: string})[];
  } catch (error) {
    console.error('Error al obtener Artículos de Inventario (MySQL):', error);
    return [];
  }
}
