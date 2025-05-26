
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Esquema para la validación de órdenes de venta/facturas
export const SaleOrderSchema = z.object({
  id: z.string().optional(),
  invoiceNumber: z.string().min(1, 'El número de factura es requerido.'),
  customer: z.string().min(1, 'El cliente es requerido.'),
  date: z.string().min(1, 'La fecha es requerida.'),
  totalAmount: z.coerce.number().positive('El monto total debe ser positivo.'),
  status: z.enum(["Borrador", "Confirmada", "Enviada", "Entregada", "Pagada", "Cancelada"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
  // items: z.array(z.object(...)) // Podrías añadir items de la venta aquí
});

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
  saleOrder?: SaleOrderFormInput;
}

// Simulación de base de datos en memoria
let DUMMY_SALES_ORDERS_DB: SaleOrderFormInput[] = [
  { id: "1", invoiceNumber: "INV-2024-001", customer: "Cliente X", date: "2024-07-10", totalAmount: 750.50, status: "Pagada" },
  { id: "2", invoiceNumber: "INV-2024-002", customer: "Cliente Y", date: "2024-07-12", totalAmount: 1200.00, status: "Entregada" },
];
let nextSOId = 3;

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

  try {
    const newSaleOrder = { ...validatedFields.data, id: String(nextSOId++) };
    // TODO: Lógica para insertar en la base de datos MySQL
    DUMMY_SALES_ORDERS_DB.push(newSaleOrder);
    console.log('Orden de Venta añadida (simulado):', newSaleOrder);

    revalidatePath('/sales');
    return {
      success: true,
      message: 'Orden de Venta añadida exitosamente.',
      saleOrder: newSaleOrder,
    };
  } catch (error) {
    console.error('Error al añadir Orden de Venta (simulado):', error);
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

  try {
    // TODO: Lógica para actualizar en la base de datos MySQL
    const index = DUMMY_SALES_ORDERS_DB.findIndex(so => so.id === validatedFields.data.id);
    if (index === -1) {
      return { success: false, message: 'Orden de Venta no encontrada.' };
    }
    DUMMY_SALES_ORDERS_DB[index] = { ...DUMMY_SALES_ORDERS_DB[index], ...validatedFields.data };
    console.log('Orden de Venta actualizada (simulado):', DUMMY_SALES_ORDERS_DB[index]);
    
    revalidatePath('/sales');
    return {
      success: true,
      message: 'Orden de Venta actualizada exitosamente.',
      saleOrder: DUMMY_SALES_ORDERS_DB[index],
    };
  } catch (error) {
    console.error('Error al actualizar Orden de Venta (simulado):', error);
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

  try {
    // TODO: Lógica para eliminar de la base de datos MySQL
    const initialLength = DUMMY_SALES_ORDERS_DB.length;
    DUMMY_SALES_ORDERS_DB = DUMMY_SALES_ORDERS_DB.filter(so => so.id !== soId);
    
    if (DUMMY_SALES_ORDERS_DB.length === initialLength) {
        return { success: false, message: 'Orden de Venta no encontrada para eliminar.' };
    }
    console.log('Orden de Venta eliminada (simulado), ID:', soId);

    revalidatePath('/sales');
    return {
      success: true,
      message: 'Orden de Venta eliminada exitosamente.',
    };
  } catch (error) {
    console.error('Error al eliminar Orden de Venta (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar Orden de Venta.',
      errors: { general: ['No se pudo eliminar la orden de venta.'] },
    };
  }
}

// Función para obtener datos (simulada)
export async function getSaleOrders() {
  // TODO: Lógica para obtener Órdenes de Venta de la base de datos MySQL
  console.log('Obteniendo Órdenes de Venta (simulado)');
  return DUMMY_SALES_ORDERS_DB;
}
