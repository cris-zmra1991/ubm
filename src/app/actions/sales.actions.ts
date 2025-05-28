
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '../../lib/db'; // Ajustado a ruta relativa
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { SaleOrderSchema, type SaleOrderItemFormInput } from '../schemas/sales.schemas';
// import { adjustStock } from './inventory.actions'; // Para ajustar stock

export type SaleOrderFormInput = z.infer<typeof SaleOrderSchema>;

export interface SaleOrderActionResponse {
  success: boolean;
  message: string;
  errors?: {
    customerId?: string[];
    date?: string[];
    status?: string[];
    items?: string[];
    general?: string[];
    itemErrors?: { index: number, field: string, message: string }[];
  };
  saleOrder?: SaleOrderFormInput & { id: string; invoiceNumber: string; totalAmount: number };
}

// Tipo para representar la orden de venta completa con sus items y nombre del cliente
export interface SaleOrderWithDetails extends Omit<SaleOrderFormInput, 'customerId'> {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  customerId: string;
  customerName?: string; // Nombre del cliente
  items: (SaleOrderItemFormInput & { itemName?: string; itemSku?: string })[];
}

// TODO: SQL - CREATE TABLE sale_orders (id INT AUTO_INCREMENT PRIMARY KEY, invoiceNumber VARCHAR(255) NOT NULL UNIQUE, customer_id INT, date DATE NOT NULL, totalAmount DECIMAL(10, 2) NOT NULL, status ENUM('Borrador', 'Confirmada', 'Enviada', 'Entregada', 'Pagada', 'Cancelada') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES contacts(id));
// TODO: SQL - CREATE TABLE sale_order_items (id INT AUTO_INCREMENT PRIMARY KEY, sale_order_id INT NOT NULL, inventory_item_id INT NOT NULL, quantity INT NOT NULL, unit_price DECIMAL(10, 2) NOT NULL, total_item_price DECIMAL(10,2) NOT NULL, FOREIGN KEY (sale_order_id) REFERENCES sale_orders(id) ON DELETE CASCADE, FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id));


async function generateInvoiceNumber(connection: Connection, insertId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `PV-${year}${month}-${insertId.toString().padStart(4, '0')}`;
}

export async function addSaleOrder(
  data: SaleOrderFormInput
): Promise<SaleOrderActionResponse> {
  const validatedFields = SaleOrderSchema.safeParse(data);

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

  const { customerId, date, status, items } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Validar stock suficiente para cada item
    for (const item of items) {
      const [stockRows] = await connection.query<RowDataPacket[]>(
        'SELECT currentStock FROM inventory_items WHERE id = ?',
        [item.inventoryItemId]
      );
      if (stockRows.length === 0 || stockRows[0].currentStock < item.quantity) {
        await connection.rollback();
        const itemErrors = items.map((it, index) => {
          if (it.inventoryItemId === item.inventoryItemId && (stockRows.length === 0 || stockRows[0].currentStock < it.quantity)) {
            return { index, field: 'quantity', message: `Stock insuficiente para el artículo (disponible: ${stockRows[0]?.currentStock ?? 0}).`};
          }
          return null;
        }).filter(e => e !== null);

        return {
          success: false,
          message: 'Stock insuficiente para uno o más artículos.',
          errors: { items: ['Verifica las cantidades y el stock disponible.'], itemErrors: itemErrors as any },
        };
      }
    }


    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // Asumimos que la columna 'customer' ahora almacena el customerId (como string si la columna es VARCHAR)
    // Idealmente, esta columna se llamaría customer_id y sería INT FK a contacts.id
    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO sale_orders (customer, date, totalAmount, status) VALUES (?, ?, ?, ?)',
      [customerId, date, totalAmount, status]
    );
    const saleOrderId = orderResult.insertId;

    if (saleOrderId <= 0) {
      await connection.rollback();
      return { success: false, message: 'No se pudo crear la cabecera de la orden de venta.' };
    }

    const invoiceNumber = await generateInvoiceNumber(connection, saleOrderId);
    await connection.query(
      'UPDATE sale_orders SET invoiceNumber = ? WHERE id = ?',
      [invoiceNumber, saleOrderId]
    );

    for (const item of items) {
      const totalItemPrice = item.quantity * item.unitPrice;
      await connection.query<ResultSetHeader>(
        'INSERT INTO sale_order_items (sale_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
        [saleOrderId, parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
      );
    }

    if (status === 'Confirmada' || status === 'Enviada' || status === 'Entregada') {
         for (const item of items) {
            await connection.query(
                'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
                [item.quantity, item.inventoryItemId]
            );
        }
    }

    await connection.commit();

    revalidatePath('/sales', 'layout');
    return {
      success: true,
      message: 'Orden de Venta añadida exitosamente.',
      saleOrder: { ...validatedFields.data, id: saleOrderId.toString(), invoiceNumber, totalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir Orden de Venta (MySQL):', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      if (error.message.includes('fk_soi_inventory_item')) {
        return { success: false, message: 'Error: Uno o más artículos de inventario seleccionados no existen.', errors: { items: ['Artículo de inventario inválido.'] } };
      }
       if (error.message.includes('sale_orders_ibfk_1') || error.message.includes('fk_so_customer')) { // Ajusta el nombre del FK si es diferente
         return { success: false, message: 'Error: El cliente seleccionado no existe.', errors: { customerId: ['Cliente inválido.'] } };
      }
    }
    return {
      success: false,
      message: 'Error del servidor al añadir Orden de Venta.',
      errors: { general: ['No se pudo añadir la orden de venta.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function updateSaleOrder(
  data: SaleOrderFormInput & { id: string; invoiceNumber?: string; totalAmount?: number}
): Promise<SaleOrderActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de Orden de Venta requerido para actualizar.' };
  }
  
  const validatedFields = SaleOrderSchema.omit({ items: true }).safeParse(data);

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
  const { customerId, date, status } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [currentOrderRows] = await connection.query<RowDataPacket[]>(
      'SELECT status, invoiceNumber, totalAmount FROM sale_orders WHERE id = ?',
      [id]
    );
    if (currentOrderRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'Orden de Venta no encontrada.' };
    }
    const currentOrder = currentOrderRows[0];
    const oldStatus = currentOrder.status;

    // Asumimos que la columna 'customer' ahora almacena el customerId
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE sale_orders SET customer = ?, date = ?, status = ? WHERE id = ?',
      [customerId, date, status, id]
    );

    const descontarStockAhora = ['Confirmada', 'Enviada', 'Entregada'].includes(status);
    const yaSeDescontoStock = ['Confirmada', 'Enviada', 'Entregada', 'Pagada'].includes(oldStatus);

    if (descontarStockAhora && !yaSeDescontoStock) {
      const [itemRows] = await connection.query<RowDataPacket[]>(
        'SELECT inventory_item_id, quantity FROM sale_order_items WHERE sale_order_id = ?',
        [id]
      );

      for (const item of itemRows) {
        const [stockRows] = await connection.query<RowDataPacket[]>(
          'SELECT currentStock FROM inventory_items WHERE id = ?',
          [item.inventory_item_id]
        );
        if (stockRows.length === 0 || stockRows[0].currentStock < item.quantity) {
          await connection.rollback();
          return { success: false, message: `Stock insuficiente para el artículo ID ${item.inventory_item_id} al intentar actualizar estado.` };
        }
      }
      for (const item of itemRows) {
        await connection.query(
          'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );
        console.log(`Stock para item ${item.inventory_item_id} disminuido en ${item.quantity} por OV ${data.invoiceNumber}`);
      }
    }
    // TODO: Lógica para REVERSAR stock si una orden se cancela DESPUÉS de que el stock fue descontado.

    await connection.commit();

    if (result.affectedRows > 0) {
      revalidatePath('/sales', 'layout');
      return {
        success: true,
        message: 'Orden de Venta actualizada exitosamente.',
        saleOrder: { ...data, ...validatedFields.data, invoiceNumber: currentOrder.invoiceNumber, totalAmount: parseFloat(currentOrder.totalAmount) },
      };
    } else {
      return { success: false, message: 'Orden de Venta no encontrada o sin cambios.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al actualizar Orden de Venta (MySQL):', error);
     if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: El cliente seleccionado no existe o un artículo es inválido.', errors: { customerId: ['Cliente inválido.'] } };
    }
    return {
      success: false,
      message: 'Error del servidor al actualizar Orden de Venta.',
      errors: { general: ['No se pudo actualizar la orden de venta.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function deleteSaleOrder(
  soId: string
): Promise<SaleOrderActionResponse> {
   if (!soId) {
    return { success: false, message: 'ID de Orden de Venta requerido para eliminar.' };
  }
  if (!pool) {
    console.error('Error: Pool de conexiones no disponible.');
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  let connection: Connection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // TODO: Antes de eliminar, considerar si el stock debe ser reversado.
    await connection.query('DELETE FROM sale_order_items WHERE sale_order_id = ?', [soId]);
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM sale_orders WHERE id = ?',
      [soId]
    );
    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/sales', 'layout');
        return {
          success: true,
          message: 'Orden de Venta eliminada exitosamente.',
        };
    } else {
        return { success: false, message: 'Orden de Venta no encontrada para eliminar.' };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al eliminar Orden de Venta (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar Orden de Venta.',
      errors: { general: ['No se pudo eliminar la orden de venta.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function getSaleOrders(): Promise<(Omit<SaleOrderFormInput, 'items' | 'customerId'> & {id: string; invoiceNumber: string; totalAmount: number; customerName?: string; customerId: string;})[]> {
  if (!pool) {
    console.error('Error: Pool de conexiones no disponible en getSaleOrders.');
    return [];
  }
  try {
    // TODO: SQL - LEFT JOIN con tabla de contactos (clientes) para obtener el nombre del cliente
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT so.id, so.invoiceNumber, so.customer as customerId, c.name as customerName, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.totalAmount, so.status 
       FROM sale_orders so
       LEFT JOIN contacts c ON so.customer = c.id
       ORDER BY so.date DESC, so.id DESC`
    );
    return rows.map(row => ({
        id: row.id.toString(),
        invoiceNumber: row.invoiceNumber,
        customerId: row.customerId, // El ID del cliente
        customerName: row.customerName, // El nombre del cliente
        date: row.date,
        totalAmount: parseFloat(row.totalAmount),
        status: row.status
    })) as (Omit<SaleOrderFormInput, 'items' | 'customerId'> & {id: string; invoiceNumber: string; totalAmount: number; customerName?: string; customerId: string;})[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Venta (MySQL):', error);
    return [];
  }
}

export async function getSaleOrderById(id: string): Promise<SaleOrderWithDetails | null> {
    if (!pool) {
       console.error('Error: Pool de conexiones no disponible en getSaleOrderById.');
      return null;
    }
    try {
        const [orderRows] = await pool.query<RowDataPacket[]>(`
            SELECT so.id, so.invoiceNumber, so.customer as customerId, c.name as customerName, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.totalAmount, so.status 
            FROM sale_orders so
            LEFT JOIN contacts c ON so.customer = c.id
            WHERE so.id = ?`,
            [id]
        );
        if (orderRows.length === 0) return null;
        const orderData = orderRows[0];

        const [itemRows] = await pool.query<RowDataPacket[]>(`
            SELECT soi.inventory_item_id, soi.quantity, soi.unit_price, ii.name as itemName, ii.sku as itemSku
            FROM sale_order_items soi
            JOIN inventory_items ii ON soi.inventory_item_id = ii.id
            WHERE soi.sale_order_id = ?
        `, [id]);

        return {
            id: orderData.id.toString(),
            invoiceNumber: orderData.invoiceNumber,
            customerId: orderData.customerId.toString(),
            customerName: orderData.customerName,
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
        } as SaleOrderWithDetails; // Asegúrate que este tipo esté definido correctamente
    } catch (error) {
        console.error(`Error al obtener orden de venta ${id} con items:`, error);
        return null;
    }
}


export async function getSalesLastMonthValue(): Promise<number> {
  if (!pool) {
    console.error('Error: Connection pool not available in getSalesLastMonthValue.');
    return 0;
  }
  try {
    // TODO: SQL - Asegúrate de que la tabla 'sale_orders' tenga una columna 'date' y 'totalAmount'.
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(totalAmount) as total FROM sale_orders WHERE status = 'Pagada' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
    );
    if (rows.length > 0 && rows[0].total) {
      return parseFloat(rows[0].total);
    }
    return 0;
  } catch (error) {
    console.error('Error al obtener valor de ventas del último mes (MySQL):', error);
    return 0;
  }
}

    