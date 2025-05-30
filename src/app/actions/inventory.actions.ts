
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import { InventoryItemSchema, AdjustStockSchema } from '@/app/schemas/inventory.schemas';


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

  const { name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, inventory_asset_account_id, cogs_account_id, defaultCreditAccountId, feePercentage, salePrice } = validatedFields.data;
  let finalSalePrice = salePrice;
  if (salePrice === null && feePercentage !== null && unitPrice > 0) {
    finalSalePrice = parseFloat((unitPrice * (1 + feePercentage / 100)).toFixed(2));
  }


  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO inventory_items (name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, inventory_asset_account_id, cogs_account_id, default_credit_account_id, fee_percentage, sale_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl || null, supplier || null, inventory_asset_account_id || null, cogs_account_id || null, defaultCreditAccountId || null, feePercentage, finalSalePrice]
    );

    if (result.affectedRows > 0) {
      const newItemId = result.insertId.toString();
      revalidatePath('/inventory', 'layout');
      return {
        success: true, message: 'Artículo de inventario añadido.',
        inventoryItem: { ...validatedFields.data, id: newItemId, salePrice: finalSalePrice },
      };
    } else {
      return { success: false, message: 'No se pudo añadir el artículo.' };
    }
  } catch (error: any) {
    console.error('Error al añadir artículo (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El SKU ya existe.', errors: { sku: ['Este SKU ya está registrado.'] } };
    }
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        let fieldError = 'general';
        if (error.message.includes('fk_inventory_asset_account')) fieldError = 'inventory_asset_account_id';
        if (error.message.includes('fk_inventory_cogs_account')) fieldError = 'cogs_account_id';
        if (error.message.includes('fk_inventory_credit_account')) fieldError = 'defaultCreditAccountId';
        return { success: false, message: 'Error: Una de las cuentas contables seleccionadas no existe.', errors: { [fieldError]: ['Cuenta contable inválida.'] } };
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

  const { id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, inventory_asset_account_id, cogs_account_id, defaultCreditAccountId, feePercentage, salePrice } = validatedFields.data;
  let finalSalePrice = salePrice;
  if (salePrice === null && feePercentage !== null && unitPrice > 0) {
    finalSalePrice = parseFloat((unitPrice * (1 + feePercentage / 100)).toFixed(2));
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE inventory_items SET name = ?, sku = ?, category = ?, currentStock = ?, reorderLevel = ?, unitPrice = ?, imageUrl = ?, supplier = ?, inventory_asset_account_id = ?, cogs_account_id = ?, default_credit_account_id = ?, fee_percentage = ?, sale_price = ? WHERE id = ?',
      [name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl || null, supplier || null, inventory_asset_account_id || null, cogs_account_id || null, defaultCreditAccountId || null, feePercentage, finalSalePrice, parseInt(id)]
    );

    if (result.affectedRows > 0) {
      revalidatePath('/inventory', 'layout');
      revalidatePath('/sales', 'layout'); 
      revalidatePath('/purchases', 'layout'); 
      return {
        success: true, message: 'Artículo de inventario actualizado.',
        inventoryItem: { ...validatedFields.data, id: id!, salePrice: finalSalePrice },
      };
    } else {
      return { success: false, message: 'Artículo no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar artículo (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El SKU ya existe para otro artículo.', errors: { sku: ['Este SKU ya está registrado.'] } };
    }
     if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        let fieldError = 'general';
        if (error.message.includes('fk_inventory_asset_account')) fieldError = 'inventory_asset_account_id';
        if (error.message.includes('fk_inventory_cogs_account')) fieldError = 'cogs_account_id';
        if (error.message.includes('fk_inventory_credit_account')) fieldError = 'defaultCreditAccountId';
        return { success: false, message: 'Error: Una de las cuentas contables seleccionadas no existe.', errors: { [fieldError]: ['Cuenta contable inválida.'] } };
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
        revalidatePath('/inventory', 'layout');
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
      'SELECT * FROM inventory_items WHERE id = ? FOR UPDATE', 
      [parseInt(itemId)]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'Artículo no encontrado.' };
    }

    const currentItemData = itemRows[0];
    const currentItem: InventoryItemFormInput = {
        id: currentItemData.id.toString(),
        name: currentItemData.name,
        sku: currentItemData.sku,
        category: currentItemData.category,
        currentStock: Number(currentItemData.currentStock),
        reorderLevel: Number(currentItemData.reorderLevel),
        unitPrice: parseFloat(currentItemData.unitPrice),
        imageUrl: currentItemData.imageUrl,
        supplier: currentItemData.supplier,
        inventory_asset_account_id: currentItemData.inventory_asset_account_id?.toString() || null,
        cogs_account_id: currentItemData.cogs_account_id?.toString() || null,
        defaultCreditAccountId: currentItemData.default_credit_account_id?.toString() || null,
        feePercentage: currentItemData.fee_percentage !== null ? parseFloat(currentItemData.fee_percentage) : null,
        salePrice: currentItemData.sale_price !== null ? parseFloat(currentItemData.sale_price) : null,
    };
    
    const newStock = currentItem.currentStock + quantityChange;

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
    // INSERT INTO stock_adjustments_log (inventory_item_id, quantity_change, reason, new_stock, user_id, adjustment_date) VALUES (?, ?, ?, ?, ?, CURDATE());
    // TODO: Generar asiento contable para el ajuste de stock si es necesario (ej. Dr. Gasto por Merma, Cr. Inventario)

    await connection.commit();

    revalidatePath('/inventory', 'layout');
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
      'SELECT id, name, sku, category, currentStock, reorderLevel, unitPrice, imageUrl, supplier, inventory_asset_account_id, cogs_account_id, default_credit_account_id, fee_percentage, sale_price FROM inventory_items ORDER BY name ASC'
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
        inventory_asset_account_id: row.inventory_asset_account_id?.toString() || null,
        cogs_account_id: row.cogs_account_id?.toString() || null,
        defaultCreditAccountId: row.default_credit_account_id?.toString() || null,
        feePercentage: row.fee_percentage !== null ? parseFloat(row.fee_percentage) : null,
        salePrice: row.sale_price !== null ? parseFloat(row.sale_price) : null,
    })) as (InventoryItemFormInput & {id: string})[];
  } catch (error) {
    console.error('Error al obtener Artículos de Inventario (MySQL):', error);
    return [];
  }
}
