
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { SaleOrderSchema, type SaleOrderItemFormInput } from '../schemas/sales.schemas';
import { addJournalEntry } from './accounting.actions';

export type SaleOrderFormInput = z.infer<typeof SaleOrderSchema>;

export interface SaleOrderActionResponse {
  success: boolean;
  message: string;
  errors?: any; 
  saleOrder?: SaleOrderFormInput & { id: string; invoiceNumber: string; totalAmount: number };
  itemErrors?: { index: number; field: 'quantity' | 'inventoryItemId' | 'unitPrice'; message: string }[];
}

export interface SaleOrderWithDetails extends Omit<SaleOrderFormInput, 'customerId'> {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  customerId: string;
  customerName?: string;
  description: string;
  items: (SaleOrderItemFormInput & { itemName?: string; itemSku?: string; unitPrice: number })[];
}


async function generateInvoiceNumber(connection: Connection): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');

  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM sale_orders WHERE DATE(created_at) = CURDATE()"
  );
  const countToday = rows[0].count + 1;

  return `PV-${year}${month}${day}-${countToday.toString().padStart(3, '0')}`;
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
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { customerId, date, status, items, description } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const itemErrors: SaleOrderActionResponse['itemErrors'] = [];
    if (['Confirmada', 'Enviada', 'Entregada'].includes(status)) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const [stockRows] = await connection.query<RowDataPacket[]>(
            'SELECT currentStock, name FROM inventory_items WHERE id = ?',
            [parseInt(item.inventoryItemId)]
          );
          if (stockRows.length === 0 || stockRows[0].currentStock < item.quantity) {
            itemErrors.push({ index: i, field: 'quantity', message: `Stock insuficiente para ${stockRows[0]?.name || 'artículo desc.'} (Disp: ${stockRows[0]?.currentStock ?? 0})` });
          }
        }
        if (itemErrors.length > 0) {
          await connection.rollback();
          return {
            success: false, message: 'Stock insuficiente para uno o más artículos.',
            errors: { items: ['Verifica las cantidades y el stock disponible.'] },
            itemErrors: itemErrors,
          };
        }
    }


    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO sale_orders (customer_id, date, description, totalAmount, status) VALUES (?, ?, ?, ?, ?)',
      [parseInt(customerId), date, description, totalAmount, status]
    );
    const saleOrderId = orderResult.insertId;

    if (saleOrderId <= 0) {
      await connection.rollback();
      return { success: false, message: 'No se pudo crear la cabecera de la orden de venta.' };
    }

    const invoiceNumber = await generateInvoiceNumber(connection);
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

    if (['Confirmada', 'Enviada', 'Entregada'].includes(status)) {
      const DEFAULT_ACCOUNTS_RECEIVABLE_CODE = "1.1.02"; 

      for (const item of items) {
        await connection.query(
          'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
          [item.quantity, parseInt(item.inventoryItemId)]
        );

        const [invItemRows] = await connection.query<RowDataPacket[]>(
          'SELECT default_debit_account_id, default_credit_account_id, unitPrice as costPrice FROM inventory_items WHERE id = ?',
          [item.inventoryItemId]
        );
        if (invItemRows.length === 0 || !invItemRows[0].default_debit_account_id || !invItemRows[0].default_credit_account_id) {
          await connection.rollback();
          return { success: false, message: `Artículo ID ${item.inventoryItemId} no tiene cuentas contables (débito/crédito) configuradas.` };
        }
        const [cogsAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]);
        const [revenueAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_credit_account_id]);

        if (cogsAccRows.length === 0 || revenueAccRows.length === 0) {
            await connection.rollback();
            return { success: false, message: `Una o ambas cuentas para el item ${item.inventoryItemId} no fueron encontradas.`};
        }
        const cogsAccountCode = cogsAccRows[0].code;
        const revenueAccountCode = revenueAccRows[0].code;
        const inventoryAssetAccountCode = cogsAccountCode; 

        await addJournalEntry({
          date, entryNumber: '', description: `Venta Fac ${invoiceNumber}: ${description}`,
          debitAccountCode: DEFAULT_ACCOUNTS_RECEIVABLE_CODE,
          creditAccountCode: revenueAccountCode,
          amount: item.quantity * item.unitPrice, 
        }, connection);

        const itemCost = parseFloat(invItemRows[0].costPrice);
        await addJournalEntry({
          date, entryNumber: '', description: `Costo Venta Fac ${invoiceNumber}: ${description}`,
          debitAccountCode: cogsAccountCode,
          creditAccountCode: inventoryAssetAccountCode, 
          amount: item.quantity * itemCost,
        }, connection);
      }
    }

    await connection.commit();

    revalidatePath('/sales', 'layout');
    if (['Confirmada', 'Enviada', 'Entregada'].includes(status)) {
        revalidatePath('/inventory', 'layout');
        revalidatePath('/accounting', 'layout');
    }
    if (status === 'Entregada') revalidatePath('/payments', 'layout');

    return {
      success: true,
      message: 'Orden de Venta añadida exitosamente.',
      saleOrder: { ...validatedFields.data, id: saleOrderId.toString(), invoiceNumber, totalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir Orden de Venta (MySQL):', error);
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

  const validatedFields = SaleOrderSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false, message: 'Error de validación al actualizar orden.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  const { id } = data; 
  const { customerId, date, status, description, items } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [currentOrderRows] = await connection.query<RowDataPacket[]>(
      'SELECT status, invoiceNumber, totalAmount FROM sale_orders WHERE id = ?',
      [parseInt(id)]
    );
    if (currentOrderRows.length === 0) {
      await connection.rollback();
      return { success: false, message: 'Orden de Venta no encontrada.' };
    }
    const currentOrder = currentOrderRows[0];
    const oldStatus = currentOrder.status;

    if (oldStatus === 'Pagado' && status !== 'Pagado') {
        await connection.rollback();
        return { success: false, message: 'No se puede cambiar el estado de una orden ya pagada.' };
    }
     if (status === 'Pagado' && oldStatus !== 'Pagado') {
        await connection.rollback();
        return { success: false, message: 'El estado "Pagado" solo se puede establecer desde el módulo de Pagos.' };
    }

    let newTotalAmount = parseFloat(currentOrder.totalAmount);
     if (oldStatus === 'Borrador' && status === 'Borrador') { // Solo recalcular si sigue en borrador
        newTotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }
    
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE sale_orders SET customer_id = ?, date = ?, description = ?, totalAmount = ?, status = ? WHERE id = ?',
      [parseInt(customerId), date, description, newTotalAmount, status, parseInt(id)]
    );

    // Si la orden estaba en Borrador y se actualizan items (y no pasa a un estado que bloquee edición de items)
    if (oldStatus === 'Borrador' && (status === 'Borrador' || status === 'Confirmada' || status === 'Enviada' || status === 'Entregada')) {
        await connection.query('DELETE FROM sale_order_items WHERE sale_order_id = ?', [parseInt(id)]);
        for (const item of items) {
            const totalItemPrice = item.quantity * item.unitPrice;
            await connection.query<ResultSetHeader>(
                'INSERT INTO sale_order_items (sale_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
                [parseInt(id), parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
            );
        }
    }


    const descontarStockAhora = ['Confirmada', 'Enviada', 'Entregada'].includes(status);
    const yaSeDescontoStock = ['Confirmada', 'Enviada', 'Entregada', 'Pagada'].includes(oldStatus);
    const itemErrors: SaleOrderActionResponse['itemErrors'] = [];

    if (descontarStockAhora && !yaSeDescontoStock) {
      const [currentItemsRows] = await connection.query<RowDataPacket[]>(
        'SELECT inventory_item_id, quantity FROM sale_order_items WHERE sale_order_id = ?', [id]
      );

      for (let i = 0; i < currentItemsRows.length; i++) {
        const item = currentItemsRows[i];
        const [stockRows] = await connection.query<RowDataPacket[]>(
          'SELECT currentStock, name FROM inventory_items WHERE id = ?',
          [item.inventory_item_id]
        );
        if (stockRows.length === 0 || stockRows[0].currentStock < item.quantity) {
            itemErrors.push({ index: i, field: 'quantity', message: `Stock insuficiente para ${stockRows[0]?.name || 'artículo desc.'} al cambiar estado (Disp: ${stockRows[0]?.currentStock ?? 0})` });
        }
      }
      if (itemErrors.length > 0) {
        await connection.rollback();
        return { success: false, message: 'Stock insuficiente al cambiar estado.', errors: { status: ['No se puede cambiar el estado a uno que descuente stock si no hay suficiente.'] }, itemErrors };
      }

      const DEFAULT_ACCOUNTS_RECEIVABLE_CODE = "1.1.02";
      for (const item of currentItemsRows) {
        await connection.query(
          'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );

        if (oldStatus === 'Borrador' || oldStatus === 'Cancelada') {
            const [invItemRows] = await connection.query<RowDataPacket[]>('SELECT default_debit_account_id, default_credit_account_id, unitPrice as costPrice FROM inventory_items WHERE id = ?', [item.inventory_item_id]);
            if (invItemRows.length === 0 || !invItemRows[0].default_debit_account_id || !invItemRows[0].default_credit_account_id) { continue; }

            const [cogsAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]);
            const [revenueAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_credit_account_id]);
            if (cogsAccRows.length === 0 || revenueAccRows.length === 0) { continue; }

            const cogsAccountCode = cogsAccRows[0].code;
            const revenueAccountCode = revenueAccRows[0].code;
            const inventoryAssetAccountCode = cogsAccountCode;
            const itemSalePriceResult = (await connection.query<RowDataPacket[]>('SELECT unit_price FROM sale_order_items WHERE sale_order_id = ? AND inventory_item_id = ?', [id, item.inventory_item_id]))[0];
            const itemSalePrice = itemSalePriceResult[0].unit_price;


            await addJournalEntry({ date, entryNumber: '', description: `Venta Fac ${currentOrder.invoiceNumber}: ${description}`, debitAccountCode: DEFAULT_ACCOUNTS_RECEIVABLE_CODE, creditAccountCode: revenueAccountCode, amount: item.quantity * parseFloat(itemSalePrice) }, connection);
            await addJournalEntry({ date, entryNumber: '', description: `Costo Venta Fac ${currentOrder.invoiceNumber}: ${description}`, debitAccountCode: cogsAccountCode, creditAccountCode: inventoryAssetAccountCode, amount: item.quantity * parseFloat(invItemRows[0].costPrice) }, connection);
        }
      }
    }
    
    await connection.commit();

    if (result.affectedRows > 0) {
      revalidatePath('/sales', 'layout');
      if (descontarStockAhora && !yaSeDescontoStock) {
        revalidatePath('/inventory', 'layout');
        revalidatePath('/accounting', 'layout');
      }
      if (status === 'Entregada' || oldStatus === 'Entregada' || status === 'Pagado') revalidatePath('/payments', 'layout');
      return {
        success: true, message: 'Orden de Venta actualizada exitosamente.',
        saleOrder: { ...data, ...validatedFields.data, invoiceNumber: currentOrder.invoiceNumber, totalAmount: newTotalAmount },
      };
    } else {
      return { success: true, message: 'Orden de Venta sin cambios detectados.', saleOrder: { ...data, ...validatedFields.data, invoiceNumber: currentOrder.invoiceNumber, totalAmount: newTotalAmount } };
    }
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al actualizar Orden de Venta (MySQL):', error);
    return {
      success: false, message: 'Error del servidor al actualizar Orden de Venta.',
      errors: { general: ['No se pudo actualizar la orden de venta.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function deleteSaleOrder(soId: string): Promise<SaleOrderActionResponse> {
  if (!soId) {
    return { success: false, message: 'ID de Orden de Venta requerido para eliminar.' };
  }
  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  let connection: Connection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [orderStatusRows] = await connection.query<RowDataPacket[]>('SELECT status FROM sale_orders WHERE id = ?', [parseInt(soId)]);
    if (orderStatusRows.length > 0) {
        const currentStatus = orderStatusRows[0].status;
        if (!['Borrador', 'Cancelada'].includes(currentStatus)) {
            await connection.rollback();
            return { success: false, message: `No se puede eliminar una orden de venta en estado '${currentStatus}'. Considere cancelarla primero.`};
        }
    } else {
        await connection.rollback();
        return { success: false, message: 'Orden de Venta no encontrada para eliminar.'};
    }

    await connection.query('DELETE FROM sale_order_items WHERE sale_order_id = ?', [parseInt(soId)]);
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM sale_orders WHERE id = ?',
      [parseInt(soId)]
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
      success: false, message: 'Error del servidor al eliminar Orden de Venta.',
      errors: { general: ['No se pudo eliminar la orden de venta.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}

export async function getSaleOrders(): Promise<(Omit<SaleOrderFormInput, 'items' | 'customerId'> & {id: string; invoiceNumber: string; totalAmount: number; customerName?: string; customerId: string; description: string;})[]> {
  if (!pool) { return []; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT so.id, so.invoiceNumber, so.customer_id as customerId, c.name as customerName, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.description, so.totalAmount, so.status
       FROM sale_orders so
       LEFT JOIN contacts c ON so.customer_id = c.id
       ORDER BY so.date DESC, so.id DESC`
    );
    return rows.map(row => ({
        id: row.id.toString(),
        invoiceNumber: row.invoiceNumber,
        customerId: row.customerId.toString(),
        customerName: row.customerName,
        date: row.date,
        description: row.description || '',
        totalAmount: parseFloat(row.totalAmount),
        status: row.status
    })) as (Omit<SaleOrderFormInput, 'items' | 'customerId'> & {id: string; invoiceNumber: string; totalAmount: number; customerName?: string; customerId: string; description: string;})[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Venta (MySQL):', error);
    return [];
  }
}

export async function getSaleOrderById(id: string): Promise<SaleOrderWithDetails | null> {
    if (!pool) { return null; }
    try {
        const [orderRows] = await pool.query<RowDataPacket[]>(`
            SELECT so.id, so.invoiceNumber, so.customer_id as customerId, c.name as customerName, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.description, so.totalAmount, so.status
            FROM sale_orders so
            LEFT JOIN contacts c ON so.customer_id = c.id
            WHERE so.id = ?`,
            [parseInt(id)]
        );
        if (orderRows.length === 0) return null;
        const orderData = orderRows[0];

        const [itemRows] = await pool.query<RowDataPacket[]>(`
            SELECT soi.inventory_item_id, soi.quantity, soi.unit_price, ii.name as itemName, ii.sku as itemSku
            FROM sale_order_items soi
            JOIN inventory_items ii ON soi.inventory_item_id = ii.id
            WHERE soi.sale_order_id = ?
        `, [parseInt(id)]);

        return {
            id: orderData.id.toString(),
            invoiceNumber: orderData.invoiceNumber,
            customerId: orderData.customerId.toString(),
            customerName: orderData.customerName,
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
        } as SaleOrderWithDetails;
    } catch (error) {
        console.error(`Error al obtener orden de venta ${id} con items:`, error);
        return null;
    }
}


export async function getSalesLastMonthValue(): Promise<number> {
  if (!pool) { return 0; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(totalAmount) as total FROM sale_orders WHERE status = 'Pagada' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
    );
    return rows.length > 0 && rows[0].total ? parseFloat(rows[0].total) : 0;
  } catch (error) {
    console.error('Error al obtener valor de ventas del último mes (MySQL):', error);
    return 0;
  }
}

export async function updateSaleOrderStatus(id: string, status: SaleOrderFormInput["status"], dbConnection?: Connection): Promise<boolean> {
  const conn = dbConnection || await pool.getConnection();
  if (!conn) return false;

  try {
    if (!dbConnection) await conn.beginTransaction();

    const [result] = await conn.query<ResultSetHeader>(
      'UPDATE sale_orders SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );

    if (!dbConnection) await conn.commit();
    if (result.affectedRows > 0) {
        revalidatePath('/sales', 'layout');
        if (status === 'Entregada' || status === 'Pagado') revalidatePath('/payments', 'layout');
        return true;
    }
    return false;
  } catch (error) {
    if (!dbConnection && conn) await conn.rollback();
    console.error(`Error al actualizar estado de OV ${id} a ${status}:`, error);
    return false;
  } finally {
    if (!dbConnection && conn && pool) (conn as Connection).release();
  }
}

    