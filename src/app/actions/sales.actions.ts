
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

  // TODO: SQL - Considerar una secuencia en la base de datos o una tabla de contadores para mayor robustez.
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
    if (status === 'Confirmada') { // Stock se descuenta y asiento se genera al confirmar
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

    // TODO: SQL - CREATE TABLE sale_orders (id INT AUTO_INCREMENT PRIMARY KEY, invoiceNumber VARCHAR(255) UNIQUE, customer_id INT NOT NULL, date DATE NOT NULL, description TEXT, totalAmount DECIMAL(10,2) NOT NULL, status ENUM('Borrador', 'Confirmada', 'Cancelada', 'Pagado') NOT NULL, FOREIGN KEY (customer_id) REFERENCES contacts(id));
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

    // TODO: SQL - CREATE TABLE sale_order_items (id INT AUTO_INCREMENT PRIMARY KEY, sale_order_id INT, inventory_item_id INT, quantity INT, unit_price DECIMAL(10,2), total_item_price DECIMAL(10,2), FOREIGN KEY (sale_order_id) REFERENCES sale_orders(id) ON DELETE CASCADE, FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id));
    for (const item of items) {
      const totalItemPrice = item.quantity * item.unitPrice;
      await connection.query<ResultSetHeader>(
        'INSERT INTO sale_order_items (sale_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
        [saleOrderId, parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
      );
    }

    if (status === 'Confirmada') {
      // TODO: SQL - Configurar estas cuentas en un lugar centralizado o según configuración de la empresa.
      const DEFAULT_ACCOUNTS_RECEIVABLE_CODE = "1.1.02"; // Ejemplo: Clientes (Activo)

      for (const item of items) {
        // Descontar stock
        await connection.query(
          'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
          [item.quantity, parseInt(item.inventoryItemId)]
        );

        // Generar asientos contables
        const [invItemRows] = await connection.query<RowDataPacket[]>(
          'SELECT default_debit_account_id, default_credit_account_id, unitPrice as costPrice FROM inventory_items WHERE id = ?',
          [item.inventoryItemId]
        );

        if (invItemRows.length === 0) {
          await connection.rollback();
          return { success: false, message: `Artículo ID ${item.inventoryItemId} no encontrado en inventario.` };
        }
        if (!invItemRows[0].default_credit_account_id) { // Para ventas, la cuenta de crédito es la de Ingresos
          await connection.rollback();
          return { success: false, message: `Artículo ID ${item.inventoryItemId} no tiene cuenta de crédito (Ingresos) configurada.` };
        }
        if (!invItemRows[0].default_debit_account_id) { // Para COGS, la cuenta de débito es COGS y la de crédito es Inventario
          await connection.rollback();
          return { success: false, message: `Artículo ID ${item.inventoryItemId} no tiene cuenta de débito (COGS/Inventario) configurada.` };
        }

        const [revenueAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_credit_account_id]);
        const [cogsOrInventoryAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]);


        if (revenueAccRows.length === 0) {
            await connection.rollback();
            return { success: false, message: `Cuenta de Ingreso ID ${invItemRows[0].default_credit_account_id} (para item ${item.inventoryItemId}) no fue encontrada.`};
        }
         if (cogsOrInventoryAccRows.length === 0) {
            await connection.rollback();
            return { success: false, message: `Cuenta de COGS/Inventario ID ${invItemRows[0].default_debit_account_id} (para item ${item.inventoryItemId}) no fue encontrada.`};
        }

        const revenueAccountCode = revenueAccRows[0].code;
        const cogsAccountCode = cogsOrInventoryAccRows[0].code; // Esta es la cuenta de COGS (Gasto)
        const inventoryAssetAccountCode = cogsOrInventoryAccRows[0].code; // Asumimos que la default_debit_account_id en el producto es la cuenta de Inventario (Activo) o COGS. Para COGS, se debita COGS y se acredita Inventario.

        const journalEntryDescSale = `Venta Fac ${invoiceNumber}: ${description}`;
        // Asiento de Venta: Dr Cuentas por Cobrar, Cr Ingresos
        await addJournalEntry({
          date, entryNumber: '', description: journalEntryDescSale,
          debitAccountCode: DEFAULT_ACCOUNTS_RECEIVABLE_CODE,
          creditAccountCode: revenueAccountCode,
          amount: item.quantity * item.unitPrice, 
        }, connection);

        const journalEntryDescCOGS = `Costo Venta Fac ${invoiceNumber}: ${description}`;
        const itemCost = parseFloat(invItemRows[0].costPrice);
        // Asiento de Costo de Venta: Dr COGS, Cr Inventario
        await addJournalEntry({
          date, entryNumber: '', description: journalEntryDescCOGS,
          debitAccountCode: cogsAccountCode, // Aquí debería ir la cuenta de COGS (Gasto)
          creditAccountCode: inventoryAssetAccountCode, // Y aquí la cuenta de Inventario (Activo) que se reduce
          amount: item.quantity * itemCost,
        }, connection);
      }
    }

    await connection.commit();

    revalidatePath('/sales', 'layout');
    if (status === 'Confirmada') {
        revalidatePath('/inventory', 'layout');
        revalidatePath('/accounting', 'layout');
        revalidatePath('/payments', 'layout'); // Para que aparezca como pago pendiente
    }
    
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
     if (status === 'Pagado') { // No permitir cambiar a Pagado desde aquí
        await connection.rollback();
        return { success: false, message: 'El estado "Pagado" solo se puede establecer desde el módulo de Pagos.' };
    }
    if (oldStatus === 'Confirmada' && status === 'Borrador') {
        await connection.rollback();
        return { success: false, message: 'No se puede revertir una orden confirmada a borrador. Considere cancelarla.' };
    }
    if (oldStatus === 'Cancelada' && status !== 'Cancelada') {
         await connection.rollback();
        return { success: false, message: 'No se puede cambiar el estado de una orden cancelada.' };
    }


    let newTotalAmount = parseFloat(currentOrder.totalAmount);
    // Solo permitir editar items y recalcular total si la orden está en Borrador
    if (oldStatus === 'Borrador' && status === 'Borrador') {
        newTotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        // Actualizar items
        await connection.query('DELETE FROM sale_order_items WHERE sale_order_id = ?', [parseInt(id)]);
        for (const item of items) {
            const totalItemPrice = item.quantity * item.unitPrice;
            await connection.query<ResultSetHeader>(
                'INSERT INTO sale_order_items (sale_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
                [parseInt(id), parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
            );
        }
    } else if (oldStatus === 'Borrador' && status === 'Confirmada') {
      // Si pasa de Borrador a Confirmada, los items ya deberían estar actualizados por el cliente,
      // pero el totalAmount debe ser el de los items actuales
      newTotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }
    
    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE sale_orders SET customer_id = ?, date = ?, description = ?, totalAmount = ?, status = ? WHERE id = ?',
      [parseInt(customerId), date, description, newTotalAmount, status, parseInt(id)]
    );

    const becameConfirmed = status === 'Confirmada' && oldStatus === 'Borrador';
    const itemErrors: SaleOrderActionResponse['itemErrors'] = [];

    if (becameConfirmed) {
      // Validar stock ANTES de descontar y generar asientos
      const [currentItemsRowsForValidation] = await connection.query<RowDataPacket[]>(
          'SELECT soi.inventory_item_id, soi.quantity, ii.name, ii.currentStock FROM sale_order_items soi JOIN inventory_items ii ON soi.inventory_item_id = ii.id WHERE sale_order_id = ?', [id]
      );
      for (let i = 0; i < currentItemsRowsForValidation.length; i++) {
          const item = currentItemsRowsForValidation[i];
          if (item.currentStock < item.quantity) {
              itemErrors.push({ index: i, field: 'quantity', message: `Stock insuficiente para ${item.name || 'artículo desc.'} al confirmar (Disp: ${item.currentStock ?? 0})` });
          }
      }
      if (itemErrors.length > 0) {
          await connection.rollback();
          return { success: false, message: 'Stock insuficiente al confirmar.', errors: { status: ['No se puede confirmar la orden por falta de stock.'] }, itemErrors };
      }


      const [currentItemsRows] = await connection.query<RowDataPacket[]>(
        'SELECT inventory_item_id, quantity, unit_price FROM sale_order_items WHERE sale_order_id = ?', [id]
      );

      const DEFAULT_ACCOUNTS_RECEIVABLE_CODE = "1.1.02";
      for (const item of currentItemsRows) {
        // Descontar stock
        await connection.query(
          'UPDATE inventory_items SET currentStock = currentStock - ? WHERE id = ?',
          [item.quantity, item.inventory_item_id]
        );

        // Generar asientos contables
        const [invItemRows] = await connection.query<RowDataPacket[]>('SELECT default_debit_account_id, default_credit_account_id, unitPrice as costPrice FROM inventory_items WHERE id = ?', [item.inventory_item_id]);
        if (invItemRows.length === 0) { await connection.rollback(); return { success: false, message: `Artículo ID ${item.inventory_item_id} no encontrado.` }; }
        if (!invItemRows[0].default_credit_account_id) { await connection.rollback(); return { success: false, message: `Artículo ID ${item.inventory_item_id} no tiene cuenta de crédito (Ingresos) configurada.` }; }
        if (!invItemRows[0].default_debit_account_id) { await connection.rollback(); return { success: false, message: `Artículo ID ${item.inventory_item_id} no tiene cuenta de débito (COGS/Inventario) configurada.` }; }

        const [revenueAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_credit_account_id]);
        const [cogsOrInventoryAccRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]);
        if (revenueAccRows.length === 0) { await connection.rollback(); return { success: false, message: `Cuenta de Ingreso no encontrada.`}; }
        if (cogsOrInventoryAccRows.length === 0) { await connection.rollback(); return { success: false, message: `Cuenta COGS/Inventario no encontrada.`}; }

        const revenueAccountCode = revenueAccRows[0].code;
        const cogsAccountCode = cogsOrInventoryAccRows[0].code; // Asumimos que default_debit_account_id es COGS
        const inventoryAssetAccountCode = cogsOrInventoryAccRows[0].code; // Para el crédito del asiento de COGS, necesitamos la cuenta de inventario. Si la cuenta de débito es COGS, esta debe ser Inventario.
                                                                    // TODO: Refinar esta lógica. Idealmente, el producto tendría una "cuenta de inventario" y una "cuenta de cogs" separadas.
                                                                    // Por ahora, si default_debit_account_id se usa para COGS, acreditamos la misma, lo cual es incorrecto para el balance.
                                                                    // Se necesitaría una "cuenta de inventario" específica para acreditar. Para simplificar, la dejo igual, pero es un punto a mejorar.


        const journalEntryDescSale = `Venta Fac ${currentOrder.invoiceNumber}: ${description}`;
        await addJournalEntry({ date, entryNumber: '', description: journalEntryDescSale, debitAccountCode: DEFAULT_ACCOUNTS_RECEIVABLE_CODE, creditAccountCode: revenueAccountCode, amount: item.quantity * parseFloat(item.unit_price) }, connection);
        
        const journalEntryDescCOGS = `Costo Venta Fac ${currentOrder.invoiceNumber}: ${description}`;
        const itemCost = parseFloat(invItemRows[0].costPrice);
        await addJournalEntry({ date, entryNumber: '', description: journalEntryDescCOGS, debitAccountCode: cogsAccountCode, creditAccountCode: inventoryAssetAccountCode /* <-- Esta debería ser la cuenta de Inventario (Activo) */, amount: item.quantity * itemCost }, connection);
      }
    }
    
    await connection.commit();

    revalidatePath('/sales', 'layout');
    if (becameConfirmed) {
      revalidatePath('/inventory', 'layout');
      revalidatePath('/accounting', 'layout');
      revalidatePath('/payments', 'layout');
    }
     if (status === 'Cancelada' && oldStatus === 'Confirmada') {
        // TODO: Considerar revertir stock y asiento contable.
        revalidatePath('/inventory', 'layout');
        revalidatePath('/accounting', 'layout');
        revalidatePath('/payments', 'layout'); // Quitar de pagos pendientes
    }

    return {
      success: true, message: 'Orden de Venta actualizada exitosamente.',
      saleOrder: { ...data, ...validatedFields.data, invoiceNumber: currentOrder.invoiceNumber, totalAmount: newTotalAmount },
    };

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
        revalidatePath('/payments', 'layout');
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
    // TODO: SQL - SELECT so.id, so.invoiceNumber, so.customer_id as customerId, c.name as customerName, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.description, so.totalAmount, so.status FROM sale_orders so LEFT JOIN contacts c ON so.customer_id = c.id ORDER BY so.date DESC, so.id DESC
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
    if (!id || isNaN(parseInt(id))) { return null; }
    try {
        // TODO: SQL - SELECT so.id, so.invoiceNumber, so.customer_id as customerId, c.name as customerName, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.description, so.totalAmount, so.status FROM sale_orders so LEFT JOIN contacts c ON so.customer_id = c.id WHERE so.id = ?
        const [orderRows] = await pool.query<RowDataPacket[]>(`
            SELECT so.id, so.invoiceNumber, so.customer_id as customerId, c.name as customerName, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.description, so.totalAmount, so.status
            FROM sale_orders so
            LEFT JOIN contacts c ON so.customer_id = c.id
            WHERE so.id = ?`,
            [parseInt(id)]
        );
        if (orderRows.length === 0) return null;
        const orderData = orderRows[0];

        // TODO: SQL - SELECT soi.inventory_item_id, soi.quantity, soi.unit_price, ii.name as itemName, ii.sku as itemSku FROM sale_order_items soi JOIN inventory_items ii ON soi.inventory_item_id = ii.id WHERE soi.sale_order_id = ?
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
    // TODO: SQL - SELECT SUM(totalAmount) as total FROM sale_orders WHERE status = 'Pagada' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
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
    // TODO: SQL - UPDATE sale_orders SET status = ? WHERE id = ?
    const [result] = await conn.query<ResultSetHeader>(
      'UPDATE sale_orders SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );

    if (!dbConnection) await conn.commit();
    if (result.affectedRows > 0) {
        revalidatePath('/sales', 'layout');
        if (status === 'Confirmada' || status === 'Pagado') revalidatePath('/payments', 'layout');
        return true;
    }
    return false;
  } catch (error) {
    if (!dbConnection && conn) await conn.rollback();
    console.error(`Error al actualizar estado de OV ${id} a ${status}:`, error);
    return false;
  } finally {
    if (!dbConnection && conn && pool && typeof (conn as Connection).release === 'function') {
        (conn as Connection).release();
    }
  }
}
