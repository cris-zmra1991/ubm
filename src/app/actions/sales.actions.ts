
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { SaleOrderSchema } from '@/app/schemas/sales.schemas';

// SQL - CREATE TABLE para órdenes de venta/facturas
// CREATE TABLE sale_orders (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   invoiceNumber VARCHAR(255) NOT NULL UNIQUE,
//   customer VARCHAR(255) NOT NULL, -- Podría ser un FK a una tabla `customers` o `contacts`
//   date DATE NOT NULL,
//   totalAmount DECIMAL(10, 2) NOT NULL,
//   status ENUM('Borrador', 'Confirmada', 'Enviada', 'Entregada', 'Pagada', 'Cancelada') NOT NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

export type SaleOrderFormInput = z.infer<typeof SaleOrderSchema>;

export interface SaleOrderActionResponse {
  success: boolean;
  message: string;
  errors?: {
    invoiceNumber?: string[];
    customer?: string[];
    date?: string[];
    totalAmount?: string[];
    status?: string[];
    general?: string[];
  };
  saleOrder?: SaleOrderFormInput & { id: string };
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
    console.error('Error: Connection pool not available in addSaleOrder.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  
  const { invoiceNumber, customer, date, totalAmount, status } = validatedFields.data;

  try {
    // SQL - Insertar orden de venta
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO sale_orders (invoiceNumber, customer, date, totalAmount, status) VALUES (?, ?, ?, ?, ?)',
      [invoiceNumber, customer, date, totalAmount, status]
    );

    if (result.affectedRows > 0) {
      const newSOId = result.insertId.toString();
      revalidatePath('/sales');
      return {
        success: true,
        message: 'Orden de Venta añadida exitosamente.',
        saleOrder: { ...validatedFields.data, id: newSOId },
      };
    } else {
      return { success: false, message: 'No se pudo añadir la Orden de Venta.' };
    }
  } catch (error: any) {
    console.error('Error al añadir Orden de Venta (MySQL):', error);
     if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El número de factura ya existe.', errors: { invoiceNumber: ['Este número de factura ya está registrado.'] } };
    }
    return {
      success: false,
      message: 'Error del servidor al añadir Orden de Venta.',
      errors: { general: ['No se pudo añadir la orden de venta.'] },
    };
  }
}

export async function updateSaleOrder(
  data: SaleOrderFormInput
): Promise<SaleOrderActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de Orden de Venta requerido para actualizar.' };
  }
  const validatedFields = SaleOrderSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  
  if (!pool) {
    console.error('Error: Connection pool not available in updateSaleOrder.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { id, invoiceNumber, customer, date, totalAmount, status } = validatedFields.data;

  try {
    // SQL - Actualizar orden de venta
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE sale_orders SET invoiceNumber = ?, customer = ?, date = ?, totalAmount = ?, status = ? WHERE id = ?',
      [invoiceNumber, customer, date, totalAmount, status, id]
    );
    
    if (result.affectedRows > 0) {
      revalidatePath('/sales');
      return {
        success: true,
        message: 'Orden de Venta actualizada exitosamente.',
        saleOrder: { ...validatedFields.data, id: id! },
      };
    } else {
      return { success: false, message: 'Orden de Venta no encontrada o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar Orden de Venta (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El número de factura ya existe para otra venta.', errors: { invoiceNumber: ['Este número de factura ya está registrado para otra venta.'] } };
    }
    return {
      success: false,
      message: 'Error del servidor al actualizar Orden de Venta.',
      errors: { general: ['No se pudo actualizar la orden de venta.'] },
    };
  }
}

export async function deleteSaleOrder(
  soId: string
): Promise<SaleOrderActionResponse> {
  if (!soId) {
    return { success: false, message: 'ID de Orden de Venta requerido para eliminar.' };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in deleteSaleOrder.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  try {
    // SQL - Eliminar orden de venta
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM sale_orders WHERE id = ?',
      [soId]
    );
        
    if (result.affectedRows > 0) {
        revalidatePath('/sales');
        return {
          success: true,
          message: 'Orden de Venta eliminada exitosamente.',
        };
    } else {
        return { success: false, message: 'Orden de Venta no encontrada para eliminar.' };
    }
  } catch (error) {
    console.error('Error al eliminar Orden de Venta (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar Orden de Venta.',
      errors: { general: ['No se pudo eliminar la orden de venta.'] },
    };
  }
}

export async function getSaleOrders(): Promise<SaleOrderFormInput[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getSaleOrders.');
    return [];
  }
  try {
    // SQL - Obtener órdenes de venta
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, invoiceNumber, customer, DATE_FORMAT(date, "%Y-%m-%d") as date, totalAmount, status FROM sale_orders ORDER BY date DESC'
    );
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
        totalAmount: parseFloat(row.totalAmount)
    })) as SaleOrderFormInput[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Venta (MySQL):', error);
    return [];
  }
}

export async function getSalesLastMonthValue(): Promise<number> {
  if (!pool) {
    console.error('Error: Connection pool not available in getSalesLastMonthValue.');
    return 0;
  }
  try {
    // SQL - Obtener suma de ventas del último mes (ej. últimos 30 días)
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
