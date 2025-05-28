
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '../../lib/db'; // Ajustado a ruta relativa
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PurchaseOrderSchema, type PurchaseOrderItemFormInput } from '../schemas/purchases.schemas';
// import { adjustStock } from './inventory.actions'; // Para ajustar stock

export type PurchaseOrderFormInput = z.infer<typeof PurchaseOrderSchema>;

// Tipo para la respuesta de la acción, incluyendo el ID y los campos generados
export interface PurchaseOrderActionResponse {
  success: boolean;
  message: string;
  errors?: {
    vendorId?: string[];
    date?: string[];
    status?: string[];
    items?: string[];
    general?: string[];
    itemErrors?: { index: number, field: string, message: string }[];
  };
  purchaseOrder?: PurchaseOrderFormInput & { id: string; poNumber: string; totalAmount: number };
}

// Tipo para representar la orden de compra completa con sus items y nombre del proveedor
export interface PurchaseOrderWithDetails extends Omit<PurchaseOrderFormInput, 'vendorId'> {
  id: string;
  poNumber: string;
  totalAmount: number;
  vendorId: string;
  vendorName?: string; // Nombre del proveedor
  items: (PurchaseOrderItemFormInput & { itemName?: string; itemSku?: string })[];
}


// TODO: SQL - CREATE TABLE purchase_orders (id INT AUTO_INCREMENT PRIMARY KEY, poNumber VARCHAR(255) NOT NULL UNIQUE, vendor_id INT, date DATE NOT NULL, totalAmount DECIMAL(10, 2) NOT NULL, status ENUM('Borrador', 'Confirmada', 'Enviada', 'Recibida', 'Cancelada') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (vendor_id) REFERENCES contacts(id));
// TODO: SQL - CREATE TABLE purchase_order_items (id INT AUTO_INCREMENT PRIMARY KEY, purchase_order_id INT NOT NULL, inventory_item_id INT NOT NULL, quantity INT NOT NULL, unit_price DECIMAL(10, 2) NOT NULL, total_item_price DECIMAL(10,2) NOT NULL, FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE, FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id));

async function generatePoNumber(connection: Connection, insertId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `OP-${year}${month}-${insertId.toString().padStart(4, '0')}`;
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

  const { vendorId, date, status, items } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // Asumimos que la columna 'vendor' ahora almacena el vendorId (como string si la columna es VARCHAR)
    // Idealmente, esta columna se llamaría vendor_id y sería INT FK a contacts.id
    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO purchase_orders (vendor, date, totalAmount, status) VALUES (?, ?, ?, ?)',
      [vendorId, date, totalAmount, status]
    );
    const purchaseOrderId = orderResult.insertId;

    if (purchaseOrderId <= 0) {
      await connection.rollback();
      return { success: false, message: 'No se pudo crear la cabecera de la orden de compra.' };
    }

    const poNumber = await generatePoNumber(connection, purchaseOrderId);
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

    await connection.commit();

    revalidatePath('/purchases', 'layout');
    return {
      success: true,
      message: 'Orden de Compra añadida exitosamente.',
      purchaseOrder: { ...validatedFields.data, id: purchaseOrderId.toString(), poNumber, totalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir Orden de Compra (MySQL):', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      if (error.message.includes('fk_poi_inventory_item')) {
        return { success: false, message: 'Error: Uno o más artículos de inventario seleccionados no existen.', errors: { items: ['Artículo de inventario inválido.'] } };
      }
      if (error.message.includes('purchase_orders_ibfk_1') || error.message.includes('fk_po_vendor')) { // Ajusta el nombre del FK si es diferente
         return { success: false, message: 'Error: El proveedor seleccionado no existe.', errors: { vendorId: ['Proveedor inválido.'] } };
      }
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
  data: PurchaseOrderFormInput & { id: string; poNumber?: string; totalAmount?: number}
): Promise<PurchaseOrderActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de Orden de Compra requerido para actualizar.' };
  }
  
  const validatedFields = PurchaseOrderSchema.omit({ items: true }).safeParse(data);

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
  const { vendorId, date, status } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

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

    // Asumimos que la columna 'vendor' ahora almacena el vendorId
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE purchase_orders SET vendor = ?, date = ?, status = ? WHERE id = ?',
      [vendorId, date, status, id]
    );

    if (status === 'Recibida' && oldStatus !== 'Recibida') {
      const [itemRows] = await connection.query<RowDataPacket[]>(
        'SELECT inventory_item_id, quantity FROM purchase_order_items WHERE purchase_order_id = ?',
        [id]
      );
      for (const item of itemRows) {
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
      revalidatePath('/purchases', 'layout');
      return {
        success: true,
        message: 'Orden de Compra actualizada exitosamente.',
        purchaseOrder: { ...data, ...validatedFields.data, poNumber: currentOrder.poNumber, totalAmount: parseFloat(currentOrder.totalAmount) },
      };
    } else {
      return { success: false, message: 'Orden de Compra no encontrada o sin cambios.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al actualizar Orden de Compra (MySQL):', error);
     if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: El proveedor seleccionado no existe o un artículo es inválido.', errors: { vendorId: ['Proveedor inválido.'] } };
    }
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

    // Primero eliminar los items (CASCADE debería hacerlo, pero es más explícito)
    await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM purchase_orders WHERE id = ?',
      [poId]
    );
    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/purchases', 'layout');
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


export async function getPurchaseOrders(): Promise<(Omit<PurchaseOrderFormInput, 'items' | 'vendorId'> & {id: string; poNumber: string; totalAmount: number; vendorName?: string; vendorId: string})[]> {
  if (!pool) {
    console.error('Error: Pool de conexiones no disponible en getPurchaseOrders.');
    return [];
  }
  try {
    // TODO: SQL - LEFT JOIN con tabla de contactos (proveedores) para obtener el nombre del proveedor
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT po.id, po.poNumber, po.vendor as vendorId, c.name as vendorName, DATE_FORMAT(po.date, "%Y-%m-%d") as date, po.totalAmount, po.status 
         FROM purchase_orders po
         LEFT JOIN contacts c ON po.vendor = c.id 
         ORDER BY po.date DESC, po.id DESC`
    );
    return rows.map(row => ({
        id: row.id.toString(),
        poNumber: row.poNumber,
        vendorId: row.vendorId, // El ID del proveedor
        vendorName: row.vendorName, // El nombre del proveedor
        date: row.date,
        totalAmount: parseFloat(row.totalAmount),
        status: row.status,
    })) as (Omit<PurchaseOrderFormInput, 'items' | 'vendorId'> & {id: string; poNumber: string; totalAmount: number; vendorName?: string; vendorId: string})[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Compra (MySQL):', error);
    return [];
  }
}


export async function getPurchaseOrderById(id: string): Promise<PurchaseOrderWithDetails | null> {
    if (!pool) {
      console.error('Error: Pool de conexiones no disponible en getPurchaseOrderById.');
      return null;
    }
    try {
        const [orderRows] = await pool.query<RowDataPacket[]>(`
            SELECT po.id, po.poNumber, po.vendor as vendorId, c.name as vendorName, DATE_FORMAT(po.date, "%Y-%m-%d") as date, po.totalAmount, po.status 
            FROM purchase_orders po
            LEFT JOIN contacts c ON po.vendor = c.id
            WHERE po.id = ?`,
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
            vendorId: orderData.vendorId.toString(), // Almacena el ID del proveedor
            vendorName: orderData.vendorName, // Nombre del proveedor
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
        } as PurchaseOrderWithDetails; // Asegúrate que este tipo es correcto y está definido
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
    // TODO: SQL - Asegúrate de que la tabla 'purchase_orders' tenga una columna 'date' y 'totalAmount'.
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

    