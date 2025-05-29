
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { Connection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { PurchaseOrderSchema, type PurchaseOrderItemFormInput } from '../schemas/purchases.schemas';
import { addJournalEntry } from './accounting.actions'; // Para asientos automáticos

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
  vendorId: string; // Asegurarse que sea string
  vendorName?: string;
  description?: string; // Asegurar que esté aquí
  items: (PurchaseOrderItemFormInput & { itemName?: string; itemSku?: string })[];
}

// TODO: SQL - CREATE TABLE purchase_orders (id INT AUTO_INCREMENT PRIMARY KEY, poNumber VARCHAR(255) NOT NULL UNIQUE, vendor_id INT NOT NULL, date DATE NOT NULL, description TEXT NOT NULL, totalAmount DECIMAL(10, 2) NOT NULL, status ENUM('Borrador', 'Confirmada', 'Enviada', 'Recibida', 'Cancelada', 'Pagado') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (vendor_id) REFERENCES contacts(id));
// TODO: SQL - CREATE TABLE purchase_order_items (id INT AUTO_INCREMENT PRIMARY KEY, purchase_order_id INT NOT NULL, inventory_item_id INT NOT NULL, quantity INT NOT NULL, unit_price DECIMAL(10, 2) NOT NULL, total_item_price DECIMAL(10,2) NOT NULL, FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE, FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id));

async function generatePoNumber(connection: Connection): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  // const day = now.getDate().toString().padStart(2, '0'); // No usar el día para menos frecuencia de reseteo

  // TODO: SQL - Considerar una secuencia en la base de datos o una tabla de contadores para mayor robustez.
  // Contar las órdenes del mes actual para el secuencial.
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

    // Si la orden se confirma o recibe, generar asiento contable y/o ajustar stock
    if (status === 'Confirmada' || status === 'Recibida') {
      // TODO: Definir códigos de cuenta por defecto en un lugar centralizado o variables de entorno
      const DEFAULT_ACCOUNTS_PAYABLE_CODE = "2.1.01"; // Ejemplo: Cuentas por Pagar Proveedores

      for (const item of items) {
        const [invItemRows] = await connection.query<RowDataPacket[]>(
          'SELECT default_debit_account_id FROM inventory_items WHERE id = ?',
          [item.inventoryItemId]
        );
        if (invItemRows.length === 0 || !invItemRows[0].default_debit_account_id) {
          await connection.rollback();
          return { success: false, message: `Artículo ID ${item.inventoryItemId} no tiene cuenta de débito/inventario configurada.` };
        }
         const [debitAccountRows] = await connection.query<RowDataPacket[]>(
            'SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]
        );
        if (debitAccountRows.length === 0) {
             await connection.rollback();
            return { success: false, message: `Cuenta de débito/inventario ID ${invItemRows[0].default_debit_account_id} no encontrada.` };
        }
        const inventoryAccountCode = debitAccountRows[0].code;

        await addJournalEntry({
          date,
          entryNumber: '', // Se generará automáticamente
          description: `Compra OC ${poNumber}: ${description}`,
          debitAccountCode: inventoryAccountCode,
          creditAccountCode: DEFAULT_ACCOUNTS_PAYABLE_CODE,
          amount: item.quantity * item.unitPrice,
        }, connection);
      }
    }

    if (status === 'Recibida') {
         for (const item of items) {
            await connection.query(
                'UPDATE inventory_items SET currentStock = currentStock + ? WHERE id = ?',
                [item.quantity, parseInt(item.inventoryItemId)]
            );
        }
    }

    await connection.commit();

    revalidatePath('/purchases', 'layout');
    revalidatePath('/inventory', 'layout');
    revalidatePath('/accounting', 'layout');
    if (status === 'Recibida') revalidatePath('/payments', 'layout');

    return {
      success: true,
      message: 'Orden de Compra añadida exitosamente.',
      purchaseOrder: { ...validatedFields.data, id: purchaseOrderId.toString(), poNumber, totalAmount },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al añadir Orden de Compra (MySQL):', error);
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return { success: false, message: 'Error: El proveedor o un artículo no existe.', errors: { vendorId: ['Proveedor inválido.']}};
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
  const { vendorId, date, status, description, items } = validatedFields.data; // 'items' se usa ahora
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

    // No permitir editar si ya está Pagada
    if (oldStatus === 'Pagado') {
        await connection.rollback();
        return { success: false, message: 'No se pueden editar órdenes de compra que ya han sido pagadas.' };
    }

    // Recalcular totalAmount basado en los items actuales si la orden está en Borrador
    let newTotalAmount = parseFloat(currentOrder.totalAmount);
    if (oldStatus === 'Borrador' && status === 'Borrador') {
        newTotalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    }


    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE purchase_orders SET vendor_id = ?, date = ?, description = ?, totalAmount = ?, status = ? WHERE id = ?',
      [parseInt(vendorId), date, description, newTotalAmount, status, parseInt(id)]
    );

    // Si la orden estaba en Borrador y se actualizan items
    if (oldStatus === 'Borrador' && status === 'Borrador') {
        // Eliminar items existentes y reinsertar los nuevos
        await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [parseInt(id)]);
        for (const item of items) {
          const totalItemPrice = item.quantity * item.unitPrice;
          await connection.query<ResultSetHeader>(
            'INSERT INTO purchase_order_items (purchase_order_id, inventory_item_id, quantity, unit_price, total_item_price) VALUES (?, ?, ?, ?, ?)',
            [parseInt(id), parseInt(item.inventoryItemId), item.quantity, item.unitPrice, totalItemPrice]
          );
        }
    }

    // Lógica de ajuste de stock y asientos si el estado cambia
    const isBecomingReceived = status === 'Recibida' && oldStatus !== 'Recibida';
    const isBecomingConfirmedFromBorrador = (status === 'Confirmada' || status === 'Recibida') && oldStatus === 'Borrador';

    if (isBecomingReceived || isBecomingConfirmedFromBorrador) {
      const [orderItemsRows] = await connection.query<RowDataPacket[]>(
        'SELECT inventory_item_id, quantity, unit_price FROM purchase_order_items WHERE purchase_order_id = ?',
        [id]
      );
      const DEFAULT_ACCOUNTS_PAYABLE_CODE = "2.1.01"; // Ejemplo

      for (const item of orderItemsRows) {
        if (isBecomingReceived) {
          await connection.query(
            'UPDATE inventory_items SET currentStock = currentStock + ? WHERE id = ?',
            [item.quantity, item.inventory_item_id]
          );
        }
        if (isBecomingConfirmedFromBorrador) {
           const [invItemRows] = await connection.query<RowDataPacket[]>(
            'SELECT default_debit_account_id FROM inventory_items WHERE id = ?', [item.inventory_item_id]
          );
          if (invItemRows.length === 0 || !invItemRows[0].default_debit_account_id) {
            await connection.rollback();
            return { success: false, message: `Artículo ID ${item.inventory_item_id} no tiene cuenta de débito/inventario configurada para asiento.` };
          }
          const [debitAccountRows] = await connection.query<RowDataPacket[]>('SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]);
          if (debitAccountRows.length === 0) {
            await connection.rollback();
            return { success: false, message: `Cuenta de débito/inventario ID ${invItemRows[0].default_debit_account_id} no encontrada para asiento.` };
          }

          const inventoryAccountCode = debitAccountRows[0].code;
          await addJournalEntry({
            date, entryNumber: '', description: `Compra OC ${currentOrder.poNumber}: ${description}`,
            debitAccountCode: inventoryAccountCode, creditAccountCode: DEFAULT_ACCOUNTS_PAYABLE_CODE,
            amount: item.quantity * parseFloat(item.unit_price),
          }, connection);
        }
      }
    }
    // TODO: Reversión de stock y asientos si una orden 'Recibida' o 'Confirmada' se cancela.

    await connection.commit();

    if (result.affectedRows > 0) {
      revalidatePath('/purchases', 'layout');
      if (isBecomingReceived) revalidatePath('/inventory', 'layout');
      if (isBecomingConfirmedFromBorrador) revalidatePath('/accounting', 'layout');
      if (status === 'Recibida' || oldStatus === 'Recibida') revalidatePath('/payments', 'layout');
      return {
        success: true,
        message: 'Orden de Compra actualizada exitosamente.',
        purchaseOrder: { ...validatedFields.data, id, poNumber: currentOrder.poNumber, totalAmount: newTotalAmount },
      };
    } else {
      // Si no hubo filas afectadas pero no hubo error, podría ser que los datos eran los mismos.
      return { success: true, message: 'Orden de Compra sin cambios detectados.', purchaseOrder: { ...validatedFields.data, id, poNumber: currentOrder.poNumber, totalAmount: newTotalAmount } };
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

    // TODO: Lógica para revertir asientos contables y ajustes de stock si es necesario antes de eliminar.
    // Por ejemplo, si la orden estaba 'Recibida', el stock de los items debería decrementarse.
    // Si se generaron asientos contables, deberían revertirse. Esto puede ser complejo.
    // Por ahora, solo se permite eliminar si está en 'Borrador' o 'Cancelada' desde la UI.
    // La BD permitirá eliminarla si está en cascada, pero la lógica de negocio debería ser más estricta.

    const [orderStatusRows] = await connection.query<RowDataPacket[]>('SELECT status FROM purchase_orders WHERE id = ?', [parseInt(poId)]);
    if (orderStatusRows.length > 0) {
        const currentStatus = orderStatusRows[0].status;
        if (!['Borrador', 'Cancelada'].includes(currentStatus)) {
            await connection.rollback();
            return { success: false, message: `No se puede eliminar una orden de compra en estado '${currentStatus}'. Considere cancelarla primero.`};
        }
    }


    await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [parseInt(poId)]);
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM purchase_orders WHERE id = ?',
      [parseInt(poId)]
    );
    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/purchases', 'layout');
        // No es necesario revalidar inventario/contabilidad/pagos si solo se eliminan borradores/canceladas
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


export async function getPurchaseOrders(): Promise<(Omit<PurchaseOrderFormInput, 'items' | 'vendorId'> & {id: string; poNumber: string; totalAmount: number; vendorName?: string; vendorId: string; description?: string})[]> {
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
        description: row.description,
        totalAmount: parseFloat(row.totalAmount),
        status: row.status,
    })) as (Omit<PurchaseOrderFormInput, 'items' | 'vendorId'> & {id: string; poNumber: string; totalAmount: number; vendorName?: string; vendorId: string; description?: string})[];
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
            description: orderData.description || '', // Asegurar que description no sea null
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
    // Sumar solo las órdenes 'Pagado' o 'Recibida' (si se considera un compromiso de gasto)
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(totalAmount) as total FROM purchase_orders WHERE (status = 'Pagado' OR status = 'Recibida') AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
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
        if (status === 'Recibida' || status === 'Pagado') revalidatePath('/payments', 'layout');
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
