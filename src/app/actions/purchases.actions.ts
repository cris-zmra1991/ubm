
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

// TODO: SQL - CREATE TABLE para órdenes de compra
// CREATE TABLE purchase_orders (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   poNumber VARCHAR(255) NOT NULL UNIQUE,
//   vendor VARCHAR(255) NOT NULL,
//   date DATE NOT NULL,
//   totalAmount DECIMAL(10, 2) NOT NULL,
//   status ENUM('Borrador', 'Confirmada', 'Enviada', 'Recibida', 'Cancelada') NOT NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//   -- Podrías añadir una foreign key a una tabla de vendors si la tienes
//   -- Podrías añadir una tabla `purchase_order_items` para detallar los productos
// );

export const PurchaseOrderSchema = z.object({
  id: z.string().optional(),
  poNumber: z.string().min(1, 'El número de OC es requerido.'),
  vendor: z.string().min(1, 'El proveedor es requerido.'),
  date: z.string().min(1, 'La fecha es requerida.'), 
  totalAmount: z.coerce.number().positive('El monto total debe ser positivo.'),
  status: z.enum(["Borrador", "Confirmada", "Enviada", "Recibida", "Cancelada"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
});

export type PurchaseOrderFormInput = z.infer<typeof PurchaseOrderSchema>;

export interface PurchaseOrderActionResponse {
  success: boolean;
  message: string;
  errors?: {
    poNumber?: string[];
    vendor?: string[];
    date?: string[];
    totalAmount?: string[];
    status?: string[];
    general?: string[];
  };
  purchaseOrder?: PurchaseOrderFormInput & { id: string };
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
    console.error('Error: Connection pool not available in addPurchaseOrder.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { poNumber, vendor, date, totalAmount, status } = validatedFields.data;

  try {
    // TODO: SQL - Insertar orden de compra
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO purchase_orders (poNumber, vendor, date, totalAmount, status) VALUES (?, ?, ?, ?, ?)',
      [poNumber, vendor, date, totalAmount, status]
    );

    if (result.affectedRows > 0) {
      const newPOId = result.insertId.toString();
      revalidatePath('/purchases');
      return {
        success: true,
        message: 'Orden de Compra añadida exitosamente.',
        purchaseOrder: { ...validatedFields.data, id: newPOId },
      };
    } else {
       return { success: false, message: 'No se pudo añadir la Orden de Compra.' };
    }
  } catch (error: any) {
    console.error('Error al añadir Orden de Compra (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) { // Manejar error de poNumber duplicado
        return { success: false, message: 'Error: El número de OC ya existe.', errors: { poNumber: ['Este número de OC ya está registrado.'] } };
    }
    return {
      success: false,
      message: 'Error del servidor al añadir Orden de Compra.',
      errors: { general: ['No se pudo añadir la orden de compra.'] },
    };
  }
}

export async function updatePurchaseOrder(
  data: PurchaseOrderFormInput
): Promise<PurchaseOrderActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de Orden de Compra requerido para actualizar.' };
  }
  const validatedFields = PurchaseOrderSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in updatePurchaseOrder.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }
  
  const { id, poNumber, vendor, date, totalAmount, status } = validatedFields.data;

  try {
    // TODO: SQL - Actualizar orden de compra
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE purchase_orders SET poNumber = ?, vendor = ?, date = ?, totalAmount = ?, status = ? WHERE id = ?',
      [poNumber, vendor, date, totalAmount, status, id]
    );
    
    if (result.affectedRows > 0) {
      revalidatePath('/purchases');
      return {
        success: true,
        message: 'Orden de Compra actualizada exitosamente.',
        purchaseOrder: { ...validatedFields.data, id: id! },
      };
    } else {
      return { success: false, message: 'Orden de Compra no encontrada o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar Orden de Compra (MySQL):', error);
     if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El número de OC ya existe para otra orden.', errors: { poNumber: ['Este número de OC ya está registrado para otra orden.'] } };
    }
    return {
      success: false,
      message: 'Error del servidor al actualizar Orden de Compra.',
      errors: { general: ['No se pudo actualizar la orden de compra.'] },
    };
  }
}

export async function deletePurchaseOrder(
  poId: string
): Promise<PurchaseOrderActionResponse> {
  if (!poId) {
    return { success: false, message: 'ID de Orden de Compra requerido para eliminar.' };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in deletePurchaseOrder.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  try {
    // TODO: SQL - Eliminar orden de compra
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM purchase_orders WHERE id = ?',
      [poId]
    );
        
    if (result.affectedRows > 0) {
        revalidatePath('/purchases');
        return {
          success: true,
          message: 'Orden de Compra eliminada exitosamente.',
        };
    } else {
        return { success: false, message: 'Orden de Compra no encontrada para eliminar.' };
    }
  } catch (error) {
    console.error('Error al eliminar Orden de Compra (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar Orden de Compra.',
      errors: { general: ['No se pudo eliminar la orden de compra.'] },
    };
  }
}

export async function getPurchaseOrders(): Promise<PurchaseOrderFormInput[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getPurchaseOrders.');
    return [];
  }
  try {
    // TODO: SQL - Obtener órdenes de compra
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT id, poNumber, vendor, DATE_FORMAT(date, "%Y-%m-%d") as date, totalAmount, status FROM purchase_orders ORDER BY date DESC'
    );
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
        totalAmount: parseFloat(row.totalAmount) // Asegurar que sea número
    })) as PurchaseOrderFormInput[];
  } catch (error) {
    console.error('Error al obtener Órdenes de Compra (MySQL):', error);
    return [];
  }
}
