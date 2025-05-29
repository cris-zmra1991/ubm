
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import { PaymentSchema } from '@/app/schemas/payments.schemas';
import { updateSaleOrderStatus } from './sales.actions';
import { updatePurchaseOrderStatus } from './purchases.actions';
import { updateExpenseStatus } from './expenses.actions';
import { getSession } from '@/lib/session';

export type PaymentFormInput = z.infer<typeof PaymentSchema>;

export interface PaymentActionResponse {
  success: boolean;
  message: string;
  errors?: any;
  payment?: PaymentFormInput & { id: string };
}

export interface PendingPaymentItem {
  id: string;
  source_document_type: 'sale_order' | 'purchase_order' | 'expense';
  document_number: string; // InvoiceNumber, poNumber, o Expense ID/Description
  contact_name?: string; // Customer o Vendor name
  due_date: string; // Order date
  amount_due: number;
  currency: string; // Asumimos EUR por ahora
  description: string;
}

// TODO: SQL - CREATE TABLE payments (id INT AUTO_INCREMENT PRIMARY KEY, source_document_type ENUM('sale_order', 'purchase_order', 'expense') NOT NULL, source_document_id INT NOT NULL, payment_date DATE NOT NULL, amount DECIMAL(15, 2) NOT NULL, payment_method VARCHAR(100) NULL, reference_number VARCHAR(255) NULL, notes TEXT NULL, created_by_user_id INT NULL, FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, INDEX idx_payments_source (source_document_type, source_document_id));

export async function getPendingPayments(): Promise<PendingPaymentItem[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getPendingPayments.');
    return [];
  }
  try {
    const pendingPayments: PendingPaymentItem[] = [];

    // Ventas pendientes (estado 'Entregada')
    const [saleOrders] = await pool.query<RowDataPacket[]>(`
      SELECT so.id, so.invoiceNumber, DATE_FORMAT(so.date, "%Y-%m-%d") as date, so.totalAmount, so.description, c.name as customerName
      FROM sale_orders so
      LEFT JOIN contacts c ON so.customer_id = c.id
      WHERE so.status = 'Entregada'
    `);
    saleOrders.forEach(so => {
      pendingPayments.push({
        id: so.id.toString(),
        source_document_type: 'sale_order',
        document_number: so.invoiceNumber,
        contact_name: so.customerName,
        due_date: so.date,
        amount_due: parseFloat(so.totalAmount),
        currency: 'EUR',
        description: so.description || 'Venta',
      });
    });

    // Compras pendientes (estado 'Recibida')
    const [purchaseOrders] = await pool.query<RowDataPacket[]>(`
      SELECT po.id, po.poNumber, DATE_FORMAT(po.date, "%Y-%m-%d") as date, po.totalAmount, po.description, c.name as vendorName
      FROM purchase_orders po
      LEFT JOIN contacts c ON po.vendor_id = c.id
      WHERE po.status = 'Recibida' 
    `);
    // Nota: La OC puede no tener un totalAmount si se acaba de recibir y no se ha facturado.
    // Aquí asumimos que 'Recibida' significa que se espera un pago.
    purchaseOrders.forEach(po => {
      pendingPayments.push({
        id: po.id.toString(),
        source_document_type: 'purchase_order',
        document_number: po.poNumber,
        contact_name: po.vendorName,
        due_date: po.date,
        amount_due: parseFloat(po.totalAmount),
        currency: 'EUR',
        description: po.description || 'Compra',
      });
    });

    // Gastos pendientes (estado 'Aprobado')
    const [expenses] = await pool.query<RowDataPacket[]>(`
      SELECT id, DATE_FORMAT(date, "%Y-%m-%d") as date, amount, description, vendor
      FROM expenses
      WHERE status = 'Aprobado'
    `);
    expenses.forEach(ex => {
      pendingPayments.push({
        id: ex.id.toString(),
        source_document_type: 'expense',
        document_number: `Gasto #${ex.id}`,
        contact_name: ex.vendor,
        due_date: ex.date,
        amount_due: parseFloat(ex.amount),
        currency: 'EUR',
        description: ex.description,
      });
    });
    
    // Ordenar por fecha
    pendingPayments.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return pendingPayments;

  } catch (error) {
    console.error('Error al obtener pagos pendientes (MySQL):', error);
    return [];
  }
}

export async function processPayment(
  data: PaymentFormInput,
  sourceDocumentType: 'sale_order' | 'purchase_order' | 'expense',
  sourceDocumentId: string
): Promise<PaymentActionResponse> {
  const validatedFields = PaymentSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }

  if (!pool) {
    return { success: false, message: 'Error del servidor: DB no disponible.' };
  }
  
  const session = await getSession();
  if (!session?.userId) {
    return { success: false, message: 'Usuario no autenticado.' };
  }

  const { paymentDate, amount, paymentMethod, referenceNumber, notes } = validatedFields.data;
  let connection: Connection | null = null;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Insertar el registro de pago
    const [paymentResult] = await connection.query<ResultSetHeader>(
      'INSERT INTO payments (source_document_type, source_document_id, payment_date, amount, payment_method, reference_number, notes, created_by_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [sourceDocumentType, parseInt(sourceDocumentId), paymentDate, amount, paymentMethod, referenceNumber, notes, parseInt(session.userId)]
    );
    const paymentId = paymentResult.insertId;

    if (paymentId <= 0) {
      await connection.rollback();
      return { success: false, message: 'No se pudo registrar el pago.' };
    }

    // Actualizar estado del documento original
    let updateSuccess = false;
    if (sourceDocumentType === 'sale_order') {
      updateSuccess = await updateSaleOrderStatus(sourceDocumentId, 'Pagada', connection);
    } else if (sourceDocumentType === 'purchase_order') {
      updateSuccess = await updatePurchaseOrderStatus(sourceDocumentId, 'Pagado', connection);
    } else if (sourceDocumentType === 'expense') {
      updateSuccess = await updateExpenseStatus(sourceDocumentId, 'Pagado', connection);
    }

    if (!updateSuccess) {
      await connection.rollback();
      return { success: false, message: `No se pudo actualizar el estado del documento original (${sourceDocumentType}).` };
    }
    
    // TODO: Aquí podrías generar un asiento contable para el pago si es necesario.
    // Ejemplo: Debitar Caja/Banco, Creditar Cuentas por Cobrar (para ventas) o Cuentas por Pagar (para compras/gastos)

    await connection.commit();

    revalidatePath('/payments');
    revalidatePath(sourceDocumentType === 'sale_order' ? '/sales' : sourceDocumentType === 'purchase_order' ? '/purchases' : '/expenses');
    
    return {
      success: true,
      message: 'Pago procesado y registrado exitosamente.',
      payment: { ...validatedFields.data, id: paymentId.toString() },
    };

  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error al procesar pago (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al procesar el pago.',
      errors: { general: ['No se pudo procesar el pago.'] },
    };
  } finally {
    if (connection) connection.release();
  }
}
