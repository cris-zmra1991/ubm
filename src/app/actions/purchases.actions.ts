
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PurchaseOrderSchema, type PurchaseOrderItemFormInput } from '@/app/schemas/purchases.schemas';
import { adjustStock } from './inventory.actions'; // Para ajustar stock

export type PurchaseOrderFormInput = z.infer<typeof PurchaseOrderSchema>;

export interface PurchaseOrderActionResponse {
  success: boolean;
  message: string;
  errors?: {
    // poNumber?: string[]; // Ya no se valida aquí
    vendor?: string[];
    date?: string[];
    totalAmount?: string[]; // Se calculará
    status?: string[];
    items?: string[]; // Para errores a nivel de array de items
    general?: string[];
    itemErrors?: { index: number, field: string, message: string }[];
  };
  purchaseOrder?: PurchaseOrderFormInput & { id: string; poNumber: string; totalAmount: number };
}

async function generatePoNumber(connection: Connection, insertId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  // Podríamos usar el ID de la inserción para asegurar unicidad junto con la fecha.
  // O una secuencia más robusta si es necesario, pero para este ejemplo el ID es suficiente.
  return `OP-${year}${month}-${insertId}`;
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
    console.error('Error: Pool de conexiones no disponible.');
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { vendor, date, status, items } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // Insertar la orden de compra principal (sin poNumber inicialmente)
    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO purchase_orders (vendor, date, totalAmount, status) VALUES (?, ?, ?, ?)',
      [vendor, date, totalAmount, status]
    );
    const purchaseOrderId = orderResult.insertId;

    if (purchaseOrderId <= 0) {
      await connection.rollback();
      return { success: false, message: 'No se pudo crear la cabecera de la orden de compra.' };
    }

    // Generar y actualizar el poNumber
    const poNumber = await generatePoNumber(connection, purchaseOrderId);
    await connection.query(
      'UPDATE purchase_orders SET poNumber = ? WHERE id = ?',
      [poNumber, purchaseOrderId]
    );

    // Insertar los items de la orden de compra
    for (const item of items) {
      const totalItemPrice = item.quantity * item.unitPrice;
      await connection.query<ResultSetHeader>(
        'INSERT INTO purchase_order_items (purchase_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
        [purchaseOrderId, parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
      );
    }

    await connection.commit();

    revalidatePath('/purchases');
    return {
      success: true,
      message: 'Orden de Compra añadida exitosamente.',
      purchaseOrder: { ...validatedFields.data, id: purchaseOrderId.toString(), poNumber, totalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir Orden de Compra (MySQL):', error);
    // ER_NO_REFERENCED_ROW_2: Error de FK si inventory_item_id no existe.
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return { success: false, message: 'Error: Uno o más artículos de inventario seleccionados no existen.', errors: { items: ['Artículo de inventario inválido.'] } };
    }
    return {
      success: false,
      message: 'Error del servidor al añadir Orden de Compra.',
      errors: { general: ['No se pudo añadir la orden de compra.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function updatePurchaseOrder(
  data: PurchaseOrderFormInput & { id: string; poNumber?: string; totalAmount?: number} // poNumber y totalAmount no se editan directamente
): Promise<PurchaseOrderActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de Orden de Compra requerido para actualizar.' };
  }
  // Para la actualización, solo permitimos cambiar estado, proveedor, fecha.
  // La edición de items es más compleja y se omite por simplicidad en esta fase.
  // El usuario podría tener que cancelar y crear una nueva si los items cambian.
  const validatedFields = PurchaseOrderSchema.omit({ items: true, poNumber: true, totalAmount: true }).extend({
      status: z.enum(["Borrador", "Confirmada", "Enviada", "Recibida", "Cancelada"]), // Mantener status
      vendor: z.string().min(1),
      date: z.string().min(1)
  }).safeParse(data);


  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación al actualizar orden.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    console.error('Error: Pool de conexiones no disponible.');
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id } = data;
  const { vendor, date, status } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Obtener estado actual de la orden
    const [currentOrderRows] = await connection.query<RowDataPacket[]>(
      'SELECT status, poNumber, totalAmount FROM purchase_orders WHERE id = ?',
      [id]
    );
    if (currentOrderRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'Orden de Compra no encontrada.' };
    }
    const currentOrder = currentOrderRows[0];
    const oldStatus = currentOrder.status;

    // SQL - Actualizar campos principales de la orden de compra
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE purchase_orders SET vendor = ?, date = ?, status = ? WHERE id = ?',
      [vendor, date, status, id]
    );

    // Lógica de ajuste de stock si el estado cambia a 'Recibida'
    if (status === 'Recibida' && oldStatus !== 'Recibida') {
      const [itemRows] = await connection.query<RowDataPacket[]>(
        'SELECT inventory_item_id, quantity FROM purchase_order_items WHERE purchase_order_id = ?',
        [id]
      );
      for (const item of itemRows) {
        // Usamos la acción adjustStock para mantener la lógica centralizada si es posible,
        // o replicamos la lógica aquí si adjustStock es demasiado simple.
        // Por ahora, llamaremos a una función de ajuste directo para evitar dependencias circulares complejas.
        await connection.query(
          'UPDATE inventory_items SET currentStock = currentStock + ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );
        // TODO: Registrar el ajuste de stock en una tabla de historial si es necesario.
        console.log(`Stock para item ${item.inventory_item_id} incrementado en ${item.quantity} por OC ${data.poNumber}`);
      }
    }
    // TODO: Considerar reversión de stock si una orden 'Recibida' se cancela o cambia a otro estado.

    await connection.commit();

    if (result.affectedRows > 0) {
      revalidatePath('/purchases');
      return {
        success: true,
        message: 'Orden de Compra actualizada exitosamente.',
        // Devolver la orden con los datos actualizados (incluyendo poNumber y totalAmount originales ya que no se editan aquí)
        purchaseOrder: { ...data, ...validatedFields.data, poNumber: currentOrder.poNumber, totalAmount: parseFloat(currentOrder.totalAmount) },
      };
    } else {
      return { success: false, message: 'Orden de Compra no encontrada o sin cambios.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al actualizar Orden de Compra (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al actualizar Orden de Compra.',
      errors: { general: ['No se pudo actualizar la orden de compra.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function deletePurchaseOrder(
  poId: string
): Promise<PurchaseOrderActionResponse> {
  if (!poId) {
    return { success: false, message: 'ID de Orden de Compra requerido para eliminar.' };
  }
  if (!pool) {
    console.error('Error: Pool de conexiones no disponible.');
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  let connection: Connection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Eliminar primero los items de la orden (debido a ON DELETE CASCADE, esto podría ser automático si la FK está configurada)
    // pero es más explícito hacerlo aquí.
    await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);

    // Luego eliminar la orden principal
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM purchase_orders WHERE id = ?',
      [poId]
    );

    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/purchases');
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
      message: 'Error del servidor al eliminar Orden de Compra.',
      errors: { general: ['No se pudo eliminar la orden de compra.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

// Tipo para representar la orden de compra completa con sus items
export interface PurchaseOrderWithItems extends PurchaseOrderFormInput {
  id: string;
  poNumber: string;
  totalAmount: number;
  items: (PurchaseOrderItemFormInput & { itemName?: string; itemSku?: string })[];
}


export async function getPurchaseOrders(): Promise<(Omit<PurchaseOrderFormInput, 'items'> & {id: string; poNumber: string; totalAmount: number})[]> {
  if (!pool) {
    console.error('Error: Pool de conexiones no disponible.');
    return [];
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id, poNumber, vendor, DATE_FORMAT(date, "%Y-%m-%d") as date, totalAmount, status FROM purchase_orders ORDER BY date DESC, id DESC'
    );
    return rows.map(row => ({
        id: row.id.toString(),
        poNumber: row.poNumber,
        vendor: row.vendor,
        date: row.date,
        totalAmount: parseFloat(row.totalAmount),
        status: row.status,
        // items se cargará por separado o en una función getPurchaseOrderById
    })) as (Omit<PurchaseOrderFormInput, 'items'> & {id: string; poNumber: string; totalAmount: number})[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Compra (MySQL):', error);
    return [];
  }
}


export async function getPurchaseOrderById(id: string): Promise<PurchaseOrderWithItems | null> {
    if (!pool) return null;
    try {
        const [orderRows] = await pool.query<RowDataPacket[]>(
            'SELECT id, poNumber, vendor, DATE_FORMAT(date, "%Y-%m-%d") as date, totalAmount, status FROM purchase_orders WHERE id = ?',
            [id]
        );
        if (orderRows.length === 0) return null;
        const orderData = orderRows[0];

        const [itemRows] = await pool.query<RowDataPacket[]>(`
            SELECT poi.inventory_item_id, poi.quantity, poi.unit_price, ii.name as itemName, ii.sku as itemSku
            FROM purchase_order_items poi
            JOIN inventory_items ii ON poi.inventory_item_id = ii.id
            WHERE poi.purchase_order_id = ?
        `, [id]);

        return {
            id: orderData.id.toString(),
            poNumber: orderData.poNumber,
            vendor: orderData.vendor,
            date: orderData.date,
            totalAmount: parseFloat(orderData.totalAmount),
            status: orderData.status,
            items: itemRows.map(item => ({
                inventoryItemId: item.inventory_item_id.toString(),
                quantity: item.quantity,
                unitPrice: parseFloat(item.unit_price),
                itemName: item.itemName,
                itemSku: item.itemSku
            }))
        } as PurchaseOrderWithItems;
    } catch (error) {
        console.error(`Error al obtener orden de compra ${id} con items:`, error);
        return null;
    }
}


export async function getPurchasesLastMonthValue(): Promise<number> {
  if (!pool) {
    console.error('Error: Connection pool not available in getPurchasesLastMonthValue.');
    return 0;
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(totalAmount) as total FROM purchase_orders WHERE status = 'Recibida' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
    );
    if (rows.length > 0 && rows[0].total) {
      return parseFloat(rows[0].total);
    }
    return 0;
  } catch (error) {
    console.error('Error al obtener valor de compras del último mes (MySQL):', error);
    return 0;
  }
}
