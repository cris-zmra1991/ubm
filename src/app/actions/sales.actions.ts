
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { SaleOrderSchema, type SaleOrderItemFormInput } from '@/app/schemas/sales.schemas';
// import { adjustStock } from './inventory.actions'; // Para ajustar stock

export type SaleOrderFormInput = z.infer<typeof SaleOrderSchema>;

export interface SaleOrderActionResponse {
  success: boolean;
  message: string;
  errors?: {
    // invoiceNumber?: string[]; // Ya no se valida aquí
    customer?: string[];
    date?: string[];
    // totalAmount?: string[]; // Se calculará
    status?: string[];
    items?: string[]; // Para errores a nivel de array de items
    general?: string[];
    itemErrors?: { index: number, field: string, message: string }[];
  };
  saleOrder?: SaleOrderFormInput & { id: string; invoiceNumber: string; totalAmount: number };
}

async function generateInvoiceNumber(connection: Connection, insertId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `PV-${year}${month}-${insertId}`;
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

  const { customer, date, status, items } = validatedFields.data;
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

    // Insertar la orden de venta principal
    const [orderResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO sale_orders (customer, date, totalAmount, status) VALUES (?, ?, ?, ?)',
      [customer, date, totalAmount, status]
    );
    const saleOrderId = orderResult.insertId;

    if (saleOrderId <= 0) {
      await connection.rollback();
      return { success: false, message: 'No se pudo crear la cabecera de la orden de venta.' };
    }

    // Generar y actualizar el invoiceNumber
    const invoiceNumber = await generateInvoiceNumber(connection, saleOrderId);
    await connection.query(
      'UPDATE sale_orders SET invoiceNumber = ? WHERE id = ?',
      [invoiceNumber, saleOrderId]
    );

    // Insertar los items de la orden de venta
    for (const item of items) {
      const totalItemPrice = item.quantity * item.unitPrice;
      await connection.query<ResultSetHeader>(
        'INSERT INTO sale_order_items (sale_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
        [saleOrderId, parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
      );
      // Ajustar stock (disminuir) - Solo si la orden se crea en un estado que descuenta stock (ej. 'Confirmada', 'Enviada')
      // Para este ejemplo, asumimos que el stock se descuenta al confirmar/enviar, no al crear como 'Borrador'.
      // Esta lógica se moverá a updateSaleOrder cuando el estado cambie.
    }

    // Si el estado inicial ya descuenta stock (ej: Confirmada directa sin pasar por Borrador)
    if (status === 'Confirmada' || status === 'Enviada' || status === 'Entregada') {
         for (const item of items) {
            await connection.query(
                'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
                [item.quantity, item.inventoryItemId]
            );
        }
    }


    await connection.commit();

    revalidatePath('/sales');
    return {
      success: true,
      message: 'Orden de Venta añadida exitosamente.',
      saleOrder: { ...validatedFields.data, id: saleOrderId.toString(), invoiceNumber, totalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir Orden de Venta (MySQL):', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return { success: false, message: 'Error: Uno o más artículos de inventario seleccionados no existen.', errors: { items: ['Artículo de inventario inválido.'] } };
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
  // Solo permitir actualizar ciertos campos, no los items directamente por simplicidad.
  const validatedFields = SaleOrderSchema.omit({ items: true, invoiceNumber: true, totalAmount: true }).extend({
      status: z.enum(["Borrador", "Confirmada", "Enviada", "Entregada", "Pagada", "Cancelada"]),
      customer: z.string().min(1),
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
  const { customer, date, status } = validatedFields.data;
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

    // SQL - Actualizar orden de venta
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE sale_orders SET customer = ?, date = ?, status = ? WHERE id = ?',
      [customer, date, status, id]
    );

    // Lógica de ajuste de stock si el estado implica envío/entrega
    // Si el estado nuevo descuenta stock Y el estado viejo NO lo descontaba
    const descontarStockAhora = ['Confirmada', 'Enviada', 'Entregada'].includes(status);
    const yaSeDescontoStock = ['Confirmada', 'Enviada', 'Entregada', 'Pagada'].includes(oldStatus);

    if (descontarStockAhora && !yaSeDescontoStock) {
      const [itemRows] = await connection.query<RowDataPacket[]>(
        'SELECT inventory_item_id, quantity FROM sale_order_items WHERE sale_order_id = ?',
        [id]
      );

      // Validar stock suficiente ANTES de descontar
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
      // Si hay stock, descontar
      for (const item of itemRows) {
        await connection.query(
          'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );
        console.log(`Stock para item ${item.inventory_item_id} disminuido en ${item.quantity} por OV ${data.invoiceNumber}`);
      }
    }
    // TODO: Considerar lógica para REVERSAR stock si una orden se cancela DESPUÉS de que el stock fue descontado.
    // Por ejemplo, si pasa de 'Enviada' a 'Cancelada'.


    await connection.commit();

    if (result.affectedRows > 0) {
      revalidatePath('/sales');
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

    // TODO: Antes de eliminar, considerar si el stock debe ser reversado si la orden ya lo había descontado.
    // Esto depende de la lógica de negocio (ej. si una orden 'Enviada' se elimina, ¿se repone el stock?).
    // Por simplicidad, aquí solo eliminamos.

    await connection.query('DELETE FROM sale_order_items WHERE sale_order_id = ?', [soId]);
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM sale_orders WHERE id = ?',
      [soId]
    );
    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/sales');
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


export interface SaleOrderWithItems extends SaleOrderFormInput {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  items: (SaleOrderItemFormInput & { itemName?: string; itemSku?: string })[];
}


export async function getSaleOrders(): Promise<(Omit<SaleOrderFormInput, 'items'> & {id: string; invoiceNumber: string; totalAmount: number})[]> {
  if (!pool) {
    console.error('Error: Pool de conexiones no disponible.');
    return [];
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, invoiceNumber, customer, DATE_FORMAT(date, "%Y-%m-%d") as date, totalAmount, status FROM sale_orders ORDER BY date DESC, id DESC'
    );
    return rows.map(row => ({
        id: row.id.toString(),
        invoiceNumber: row.invoiceNumber,
        customer: row.customer,
        date: row.date,
        totalAmount: parseFloat(row.totalAmount),
        status: row.status
    })) as (Omit<SaleOrderFormInput, 'items'> & {id: string; invoiceNumber: string; totalAmount: number})[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Venta (MySQL):', error);
    return [];
  }
}

export async function getSaleOrderById(id: string): Promise<SaleOrderWithItems | null> {
    if (!pool) return null;
    try {
        const [orderRows] = await pool.query<RowDataPacket[]>(
            'SELECT id, invoiceNumber, customer, DATE_FORMAT(date, "%Y-%m-%d") as date, totalAmount, status FROM sale_orders WHERE id = ?',
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
            customer: orderData.customer,
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
        } as SaleOrderWithItems;
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
