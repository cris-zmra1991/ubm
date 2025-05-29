
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
  vendorId: string;
  vendorName?: string;
  items: (PurchaseOrderItemFormInput & { itemName?: string; itemSku?: string })[];
}

// TODO: SQL - CREATE TABLE purchase_orders (id INT AUTO_INCREMENT PRIMARY KEY, poNumber VARCHAR(255) NOT NULL UNIQUE, vendor_id INT NOT NULL, date DATE NOT NULL, description TEXT NULL, totalAmount DECIMAL(10, 2) NOT NULL, status ENUM('Borrador', 'Confirmada', 'Enviada', 'Recibida', 'Cancelada', 'Pagado') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (vendor_id) REFERENCES contacts(id));
// TODO: SQL - CREATE TABLE purchase_order_items (id INT AUTO_INCREMENT PRIMARY KEY, purchase_order_id INT NOT NULL, inventory_item_id INT NOT NULL, quantity INT NOT NULL, unit_price DECIMAL(10, 2) NOT NULL, total_item_price DECIMAL(10,2) NOT NULL, FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE, FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id));

async function generatePoNumber(connection: Connection, insertId: number): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT COUNT(*) as count FROM purchase_orders WHERE DATE(created_at) = CURDATE()"
  );
  const countToday = rows[0].count + 1; // +1 porque esta orden es la siguiente

  return `OP-${year}${month}${day}-${countToday.toString().padStart(3, '0')}`;
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

    // Si la orden se confirma, generar asiento contable y ajustar stock si es 'Recibida'
    if (status === 'Confirmada' || status === 'Recibida') {
      // TODO: Obtener las cuentas de débito y crédito predeterminadas para 'Cuentas por Pagar' o 'Banco'
      const defaultPayableAccountCode = "2.1.01"; // Ejemplo: Cuentas por Pagar Proveedores
      
      for (const item of items) {
        const [invItemRows] = await connection.query<RowDataPacket[]>(
          'SELECT default_debit_account_id FROM inventory_items WHERE id = ?',
          [item.inventoryItemId]
        );
        if (invItemRows.length === 0 || !invItemRows[0].default_debit_account_id) {
          // Considerar si esto debe ser un error que impida la transacción o un aviso
          console.warn(`Artículo de inventario ID ${item.inventoryItemId} no tiene cuenta de débito configurada.`);
          continue; // O lanzar error
        }
        const [debitAccountRows] = await connection.query<RowDataPacket[]>(
            'SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]
        );
        if (debitAccountRows.length === 0) {
            console.warn(`Cuenta de débito ID ${invItemRows[0].default_debit_account_id} no encontrada.`);
            continue;
        }
        const inventoryAccountCode = debitAccountRows[0].code; // Cuenta de Inventario (Activo)

        await addJournalEntry({
          date,
          entryNumber: '', // Se generará automáticamente en addJournalEntry
          description: `Compra OC ${poNumber}: ${description}`,
          debitAccountCode: inventoryAccountCode, // Inventario (o Gasto si no es inventariable)
          creditAccountCode: defaultPayableAccountCode, // Cuentas por Pagar o Banco
          amount: item.quantity * item.unitPrice,
        }, connection); // Pasar la conexión para la transacción
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
    revalidatePath('/accounting', 'layout');
    revalidatePath('/inventory', 'layout');
    
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
      if (error.message.includes('fk_po_vendor_contact')) {
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
  
  const validatedFields = PurchaseOrderSchema.omit({ items: true }).safeParse(data); // No se permite editar items directamente aquí

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
  const { vendorId, date, status, description } = validatedFields.data;
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

    const [result] = await connection.query<ResultSetHeader>(
      'UPDATE purchase_orders SET vendor_id = ?, date = ?, description = ?, status = ? WHERE id = ?',
      [parseInt(vendorId), date, description, status, parseInt(id)]
    );

    // Lógica de ajuste de stock si el estado cambia a 'Recibida'
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
      }
      // Si la orden se confirma o recibe ahora, y no antes, generar asiento
      if ((status === 'Confirmada' || status === 'Recibida') && !(oldStatus === 'Confirmada' || oldStatus === 'Recibida')) {
        const defaultPayableAccountCode = "2.1.01"; // Ejemplo Cuentas por Pagar
        const orderDescription = description || currentOrder.description || `Compra OC ${currentOrder.poNumber}`;
        for (const item of itemRows) {
            const [invItemRows] = await connection.query<RowDataPacket[]>(
              'SELECT default_debit_account_id FROM inventory_items WHERE id = ?', [item.inventory_item_id]
            );
             if (invItemRows.length === 0 || !invItemRows[0].default_debit_account_id) continue;
            const [debitAccountRows] = await connection.query<RowDataPacket[]>(
                'SELECT code FROM chart_of_accounts WHERE id = ?', [invItemRows[0].default_debit_account_id]
            );
            if (debitAccountRows.length === 0) continue;
            const inventoryAccountCode = debitAccountRows[0].code;

            await addJournalEntry({
              date, entryNumber: '', description: orderDescription,
              debitAccountCode: inventoryAccountCode, creditAccountCode: defaultPayableAccountCode,
              amount: item.quantity * (await connection.query<RowDataPacket[]>('SELECT unit_price from purchase_order_items WHERE purchase_order_id = ? AND inventory_item_id = ?', [id, item.inventory_item_id]))[0][0].unit_price,
            }, connection);
        }
      }
    }
    // TODO: Considerar reversión de stock y asientos si una orden 'Recibida' se cancela o cambia a un estado anterior.

    await connection.commit();

    if (result.affectedRows > 0) {
      revalidatePath('/purchases', 'layout');
      revalidatePath('/inventory', 'layout');
      revalidatePath('/accounting', 'layout');
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
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }

  // TODO: Lógica para revertir asientos contables y ajustes de stock si es necesario antes de eliminar.

  let connection: Connection | null = null;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [parseInt(poId)]);
    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM purchase_orders WHERE id = ?',
      [parseInt(poId)]
    );
    await connection.commit();

    if (result.affectedRows > 0) {
        revalidatePath('/purchases', 'layout');
        revalidatePath('/accounting', 'layout'); // Si se eliminan asientos asociados
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
        if (orderRows.length === 0) return null;
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
            description: orderData.description,
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
  if (!pool) {
    return 0;
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT SUM(totalAmount) as total FROM purchase_orders WHERE status = 'Pagado' AND date >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)" // Solo Pagadas
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

// Helper function to update status, callable internally or by payments module
export async function updatePurchaseOrderStatus(id: string, status: PurchaseOrderFormInput["status"], dbConnection?: Connection): Promise<boolean> {
  const conn = dbConnection || pool;
  if (!conn) return false;
  try {
    const [result] = await conn.query<ResultSetHeader>(
      'UPDATE purchase_orders SET status = ? WHERE id = ?',
      [status, parseInt(id)]
    );
    // Adicionalmente, si el estado es 'Recibida', se debería ajustar el stock aquí si no se hizo antes.
    // Y si se cancela una orden 'Recibida', se debería revertir el stock.
    // La lógica de asientos contables también podría ir aquí o al confirmar/recibir.
    return result.affectedRows > 0;
  } catch (error) {
    console.error(`Error al actualizar estado de OC ${id} a ${status}:`, error);
    return false;
  }
}

