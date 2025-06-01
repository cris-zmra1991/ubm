
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PurchaseOrderSchema, type PurchaseOrderItemFormInput } from '../schemas/purchases.schemas';
import { addJournalEntry } from './accounting.actions';

export type PurchaseOrderFormInput = z.infer<typeof PurchaseOrderSchema>;

export interface PurchaseOrderActionResponse {
  success: boolean;
  message: string;
  errors?: any;
  purchaseOrder?: PurchaseOrderFormInput & { id: string; poNumber: string; totalAmount: number };
}

export interface PurchaseOrderWithDetails extends Omit<PurchaseOrderFormInput, 'vendorId'> {
  id: string;
  poNumber: string;
  totalAmount: number;
  vendorId: string;
  vendorName?: string;
  description: string;
  items: (PurchaseOrderItemFormInput & { itemName?: string; itemSku?: string })[];
}


async function generatePoNumber(connection: Connection): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');

  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM purchase_orders WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?",
    [year, month]
  );
  const countMonth = rows[0].count + 1;

  return `OP-${year}${month}-${countMonth.toString().padStart(4, '0')}`;
}

export async function addPurchaseOrder(
  data: PurchaseOrderFormInput
): Promise<PurchaseOrderActionResponse> {
  const validatedFields = PurchaseOrderSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { vendorId, date, status, items, description } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO purchase_orders (vendor_id, date, description, totalAmount, status) VALUES (?, ?, ?, ?, ?)',
      [parseInt(vendorId), date, description, totalAmount, status]
    );
    const purchaseOrderId = orderResult.insertId;

    if (purchaseOrderId <= 0) {
      await connection.rollback();
      return { success: false, message: 'No se pudo crear la cabecera de la orden de compra.' };
    }

    const poNumber = await generatePoNumber(connection);
    await connection.query(
      'UPDATE purchase_orders SET poNumber = ? WHERE id = ?',
      [poNumber, purchaseOrderId]
    );

    for (const item of items) {
      const totalItemPrice = item.quantity * item.unitPrice;
      await connection.query<ResultSetHeader>(
        'INSERT INTO purchase_order_items (purchase_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
        [purchaseOrderId, parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
      );
    }

    if (status === 'Confirmada') {
      // TODO: Reemplazar "YOUR_DEFAULT_ACCOUNTS_PAYABLE_CODE" con el código real de la cuenta de Cuentas por Pagar (Proveedores) de tu plan de cuentas.
      const DEFAULT_ACCOUNTS_PAYABLE_CODE = "YOUR_DEFAULT_ACCOUNTS_PAYABLE_CODE"; // Ejemplo: "2.1.01" o "21001"

      for (const item of items) {
        await connection.query(
            'UPDATE inventory_items SET currentStock = currentStock + ? WHERE id = ?',
            [item.quantity, parseInt(item.inventoryItemId)]
        );

        const [invItemRows] = await connection.query<RowDataPacket[]>(
          'SELECT name, inventory_asset_account_id FROM inventory_items WHERE id = ?',
          [item.inventoryItemId]
        );
        if (invItemRows.length === 0) {
          await connection.rollback();
          return { success: false, message: `Artículo ID ${item.inventoryItemId} no encontrado en inventario.` };
        }
        if (!invItemRows[0].inventory_asset_account_id) {
          await connection.rollback();
          return { success: false, message: `Artículo '${invItemRows[0].name}' (ID ${item.inventoryItemId}) no tiene cuenta de activo de inventario (Activo) configurada.` };
        }
         const [debitAccountRows] = await connection.query<RowDataPacket[]>(
            'SELECT code FROM chart_of_accounts WHERE id = ? AND type = "Activo"', [invItemRows[0].inventory_asset_account_id]
        );
        if (debitAccountRows.length === 0) {
             await connection.rollback();
            return { success: false, message: `La cuenta de activo de inventario (ID ${invItemRows[0].inventory_asset_account_id}) para el artículo '${invItemRows[0].name}' no es válida o no es de tipo 'Activo'.` };
        }
        const inventoryAccountCode = debitAccountRows[0].code;

        const journalEntryDesc = `Compra OC ${poNumber}: ${description || invItemRows[0].name}`;
        const entryResult = await addJournalEntry({
          date,
          entryNumber: '',
          description: journalEntryDesc,
          debitAccountCode: inventoryAccountCode, // Dr: Inventario (Activo)
          creditAccountCode: DEFAULT_ACCOUNTS_PAYABLE_CODE, // Cr: Cuentas por Pagar (Pasivo)
          amount: item.quantity * item.unitPrice,
        }, connection);
        if (!entryResult.success) {
            await connection.rollback();
            return { success: false, message: `Error al generar asiento contable para OC ${poNumber}: ${entryResult.message}`, errors: entryResult.errors };
        }
      }
    }

    await connection.commit();

    revalidatePath('/purchases', 'layout');
    if (status === 'Confirmada') {
        revalidatePath('/inventory', 'layout');
        revalidatePath('/accounting', 'layout');
        revalidatePath('/payments', 'layout');
    }

    return {
      success: true,
      message: 'Orden de Compra añadida exitosamente.',
      purchaseOrder: { ...validatedFields.data, id: purchaseOrderId.toString(), poNumber, totalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir Orden de Compra (MySQL):', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        // Este error podría ser por vendorId o por inventory_item_id si la FK falla
        return { success: false, message: 'Error: El proveedor o un artículo referenciado no existe.', errors: { vendorId: ['Proveedor inválido o artículo no encontrado.']}};
    }
    return {
      success: false,
      message: `Error del servidor al añadir Orden de Compra: ${error.message || 'Error desconocido'}`,
      errors: { general: ['No se pudo añadir la orden de compra.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function updatePurchaseOrder(
  data: PurchaseOrderFormInput & { id: string; poNumber?: string; totalAmount?: number}
): Promise<PurchaseOrderActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de Orden de Compra requerido para actualizar.' };
  }
  if (data.status === 'Pagado') { // Prevenir cambio a Pagado desde aquí
    return { success: false, message: 'El estado "Pagado" solo se puede establecer desde el módulo de Pagos.' };
  }

  const validatedFields = PurchaseOrderSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación al actualizar orden.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id } = data;
  const { vendorId, date, status, description, items } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [currentOrderRows] = await connection.query<RowDataPacket[]>(
      'SELECT status, poNumber, totalAmount FROM purchase_orders WHERE id = ?',
      [parseInt(id)]
    );
    if (currentOrderRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'Orden de Compra no encontrada.' };
    }
    const currentOrder = currentOrderRows[0];
    const oldStatus = currentOrder.status;

    if (oldStatus === 'Pagado') {
        await connection.rollback();
        return { success: false, message: 'No se puede modificar una orden ya pagada.' };
    }
     if (oldStatus === 'Cancelada' && status !== 'Cancelada') {
         await connection.rollback();
        return { success: false, message: 'No se puede cambiar el estado de una orden cancelada (excepto a sí misma).' };
    }
    if (oldStatus === 'Confirmada' && status === 'Borrador') {
        await connection.rollback();
        return { success: false, message: 'No se puede revertir una orden confirmada a borrador. Considere cancelarla.' };
    }

    let newTotalAmount = parseFloat(currentOrder.totalAmount);
    const canEditItems = oldStatus === 'Borrador' && status === 'Borrador';

    if (canEditItems) {
        newTotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [parseInt(id)]);
        for (const item of items) {
          const totalItemPrice = item.quantity * item.unitPrice;
          await connection.query<ResultSetHeader>(
            'INSERT INTO purchase_order_items (purchase_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
            [parseInt(id), parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
          );
        }
    } else if (oldStatus === 'Borrador' && status === 'Confirmada') {
      newTotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }

    await connection.query<ResultSetHeader>(
      'UPDATE purchase_orders SET vendor_id = ?, date = ?, description = ?, totalAmount = ?, status = ? WHERE id = ?',
      [parseInt(vendorId), date, description, newTotalAmount, status, parseInt(id)]
    );

    const becameConfirmed = status === 'Confirmada' && oldStatus === 'Borrador';

    if (becameConfirmed) {
      const [orderItemsRowsForStockAndAccounting] = await connection.query<RowDataPacket[]>(
        'SELECT poi.inventory_item_id, poi.quantity, poi.unit_price, inv.name as itemName, inv.inventory_asset_account_id FROM purchase_order_items poi JOIN inventory_items inv ON poi.inventory_item_id = inv.id WHERE poi.purchase_order_id = ?', [id]
      );

      // TODO: Reemplazar "YOUR_DEFAULT_ACCOUNTS_PAYABLE_CODE" con el código real de la cuenta de Cuentas por Pagar (Proveedores) de tu plan de cuentas.
      const DEFAULT_ACCOUNTS_PAYABLE_CODE = "YOUR_DEFAULT_ACCOUNTS_PAYABLE_CODE"; // Ejemplo: "2.1.01" o "21001"

      for (const item of orderItemsRowsForStockAndAccounting) {
         await connection.query(
            'UPDATE inventory_items SET currentStock = currentStock + ? WHERE id = ?',
            [item.quantity, item.inventory_item_id]
          );

         if (!item.inventory_asset_account_id) {
            await connection.rollback();
            return { success: false, message: `Artículo '${item.itemName}' (ID ${item.inventory_item_id}) no tiene cuenta de activo de inventario configurada para el asiento.` };
          }
          const [debitAccountRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ? AND type = "Activo"', [item.inventory_asset_account_id]);
          if (debitAccountRows.length === 0) {
            await connection.rollback();
            return { success: false, message: `La cuenta de activo de inventario (ID ${item.inventory_asset_account_id}) para el artículo '${item.itemName}' no es válida o no es de tipo 'Activo'.` };
          }

          const inventoryAccountCode = debitAccountRows[0].code;
          const journalEntryDesc = `Compra OC ${currentOrder.poNumber}: ${description || item.itemName}`;
          const entryResult = await addJournalEntry({
            date, entryNumber: '', description: journalEntryDesc,
            debitAccountCode: inventoryAccountCode, creditAccountCode: DEFAULT_ACCOUNTS_PAYABLE_CODE,
            amount: item.quantity * parseFloat(item.unit_price),
          }, connection);
          if (!entryResult.success) {
            await connection.rollback();
            return { success: false, message: `Error al generar asiento contable para OC ${currentOrder.poNumber} (ítem ${item.itemName}): ${entryResult.message}`, errors: entryResult.errors };
          }
      }
    }
    // TODO: Implementar lógica para revertir stock y asientos si el estado cambia de 'Confirmada' a 'Cancelada'.

    await connection.commit();

    revalidatePath('/purchases', 'layout');
    if (becameConfirmed || status === 'Cancelada') {
        revalidatePath('/inventory', 'layout');
        revalidatePath('/accounting', 'layout');
        revalidatePath('/payments', 'layout');
    }

    return {
      success: true,
      message: 'Orden de Compra actualizada exitosamente.',
      purchaseOrder: { ...data, ...validatedFields.data, poNumber: currentOrder.poNumber, totalAmount: newTotalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al actualizar Orden de Compra (MySQL):', error);
     if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: El proveedor o un artículo referenciado no existe.', errors: { vendorId: ['Proveedor inválido o artículo no encontrado.']}};
    }
    return {
      success: false,
      message: `Error del servidor al actualizar Orden de Compra: ${error.message || 'Error desconocido'}`,
      errors: { general: ['No se pudo actualizar la orden de compra.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function deletePurchaseOrder(poId: string): Promise<PurchaseOrderActionResponse> {
  if (!poId) {
    return { success: false, message: 'ID de Orden de Compra requerido para eliminar.' };
  }
  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  let connection: Connection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orderStatusRows] = await connection.query<RowDataPacket[]>('SELECT status FROM purchase_orders WHERE id = ?', [parseInt(poId)]);
    if (orderStatusRows.length > 0) {
        const currentStatus = orderStatusRows[0].status;
        if (!['Borrador', 'Cancelada'].includes(currentStatus)) {
            await connection.rollback();
            return { success: false, message: `No se puede eliminar una orden de compra en estado '${currentStatus}'. Considere cancelarla primero si está Confirmada.`};
        }
    } else {
        await connection.rollback();
        return { success: false, message: 'Orden de Compra no encontrada para eliminar.'};
    }

    await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [parseInt(poId)]);
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM purchase_orders WHERE id = ?',
      [parseInt(poId)]
    );
    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/purchases', 'layout');
        revalidatePath('/payments', 'layout');
        return {
          success: true,
          message: 'Orden de Compra eliminada exitosamente.',
        };
    } else {
        return { success: false, message: 'Orden de Compra no encontrada para eliminar.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al eliminar Orden de Compra (MySQL):', error);
    return {
      success: false,
      message: `Error del servidor al eliminar Orden de Compra: ${error.message || 'Error desconocido'}`,
      errors: { general: ['No se pudo eliminar la orden de compra.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}


export async function getPurchaseOrders(): Promise<(Omit<PurchaseOrderFormInput, 'items' | 'vendorId'> & {id: string; poNumber: string; totalAmount: number; vendorName?: string; vendorId: string; description: string})[]> {
  if (!pool) {
    return [];
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT po.id, po.poNumber, po.vendor_id as vendorId, c.name as vendorName, DATE_FORMAT(po.date, "%Y-%m-%d") as date, po.totalAmount, po.status, po.description
         FROM purchase_orders po
         LEFT JOIN contacts c ON po.vendor_id = c.id
         ORDER BY po.date DESC, po.id DESC`
    );
    return rows.map(row => ({
        id: row.id.toString(),
        poNumber: row.poNumber,
        vendorId: row.vendorId.toString(),
        vendorName: row.vendorName,
        date: row.date,
        description: row.description || '',
        totalAmount: parseFloat(row.totalAmount),
        status: row.status,
    })) as (Omit<PurchaseOrderFormInput, 'items' | 'vendorId'> & {id: string; poNumber: string; totalAmount: number; vendorName?: string; vendorId: string; description: string})[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Compra (MySQL):', error);
    return [];
  }
}


export async function getPurchaseOrderById(id: string): Promise<PurchaseOrderWithDetails | null> {
    if (!pool) {
      console.error("DB pool no disponible en getPurchaseOrderById");
      return null;
    }
    if (!id || isNaN(parseInt(id))) {
        console.error(`ID de orden de compra inválido: ${id}`);
        return null;
    }
    try {
        const [orderRows] = await pool.query<RowDataPacket[]>(`
            SELECT po.id, po.poNumber, po.vendor_id as vendorId, c.name as vendorName, DATE_FORMAT(po.date, "%Y-%m-%d") as date, po.description, po.totalAmount, po.status
            FROM purchase_orders po
            LEFT JOIN contacts c ON po.vendor_id = c.id
            WHERE po.id = ?`,
            [parseInt(id)]
        );
        if (orderRows.length === 0) {
            console.log(`Orden de compra con ID ${id} no encontrada.`);
            return null;
        }
        const orderData = orderRows[0];

        const [itemRows] = await pool.query<RowDataPacket[]>(`
            SELECT poi.inventory_item_id, poi.quantity, poi.unit_price, ii.name as itemName, ii.sku as itemSku
            FROM purchase_order_items poi
            JOIN inventory_items ii ON poi.inventory_item_id = ii.id
            WHERE poi.purchase_order_id = ?
        `, [parseInt(id)]);

        return {
            id: orderData.id.toString(),
            poNumber: orderData.poNumber,
            vendorId: orderData.vendorId.toString(),
            vendorName: orderData.vendorName,
            date: orderData.date,
            description: orderData.description || '',
            totalAmount: parseFloat(orderData.totalAmount),
            status: orderData.status,
            items: itemRows.map(item => ({
                inventoryItemId: item.inventory_item_id.toString(),
                quantity: item.quantity,
                unitPrice: parseFloat(item.unit_price),
                itemName: item.itemName,
                itemSku: item.itemSku
            }))
        } as PurchaseOrderWithDetails;
    } catch (error) {
        console.error(`Error al obtener orden de compra ${id} con items:`, error);
        return null;
    }
}

export async function getPurchasesLastMonthValue(): Promise<number> {
  if (!pool) { return 0; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(totalAmount) as total FROM purchase_orders WHERE status = 'Pagado' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
    );
    return rows.length > 0 && rows[0].total ? parseFloat(rows[0].total) : 0;
  } catch (error) {
    console.error('Error al obtener valor de compras del último mes (MySQL):', error);
    return 0;
  }
}

export async function updatePurchaseOrderStatus(id: string, status: PurchaseOrderFormInput["status"], dbConnection?: Connection): Promise<boolean> {
  const conn = dbConnection || await pool.getConnection();
  if (!conn) {
      console.error("No DB connection for updatePurchaseOrderStatus");
      return false;
  }

  try {
    if (!dbConnection) await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      'UPDATE purchase_orders SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );

    if (!dbConnection) await conn.commit();
    if (result.affectedRows > 0) {
        revalidatePath('/purchases', 'layout');
        if (status === 'Confirmada' || status === 'Pagado') revalidatePath('/payments', 'layout');
        return true;
    }
    return false;
  } catch (error) {
    if (!dbConnection && conn) await conn.rollback();
    console.error(`Error al actualizar estado de OC ${id} a ${status}:`, error);
    return false;
  } finally {
    if (!dbConnection && conn && typeof (conn as Connection).release === 'function') {
        (conn as Connection).release();
    }
  }
}

    