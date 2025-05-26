
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Esquema para la validación de órdenes de compra
export const PurchaseOrderSchema = z.object({
  id: z.string().optional(),
  poNumber: z.string().min(1, 'El número de OC es requerido.'),
  vendor: z.string().min(1, 'El proveedor es requerido.'),
  date: z.string().min(1, 'La fecha es requerida.'), // Podría ser z.date() si se maneja conversión
  totalAmount: z.coerce.number().positive('El monto total debe ser positivo.'),
  status: z.enum(["Borrador", "Confirmada", "Enviada", "Recibida", "Cancelada"], {
    errorMap: () => ({ message: 'Selecciona un estado válido.' }),
  }),
  // items: z.array(z.object(...)) // Podrías añadir items de la OC aquí
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
  purchaseOrder?: PurchaseOrderFormInput;
}

// Simulación de base de datos en memoria
let DUMMY_PURCHASE_ORDERS_DB: PurchaseOrderFormInput[] = [
  { id: "1", poNumber: "PO-2024-001", vendor: "Proveedor Alpha", date: "2024-07-15", totalAmount: 1250.75, status: "Recibida" },
  { id: "2", poNumber: "PO-2024-002", vendor: "Proveedor Beta", date: "2024-07-18", totalAmount: 875.00, status: "Enviada" },
];
let nextPOId = 3;

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

  try {
    const newPurchaseOrder = { ...validatedFields.data, id: String(nextPOId++) };
    // TODO: Lógica para insertar en la base de datos MySQL
    DUMMY_PURCHASE_ORDERS_DB.push(newPurchaseOrder);
    console.log('Orden de Compra añadida (simulado):', newPurchaseOrder);

    revalidatePath('/purchases');
    return {
      success: true,
      message: 'Orden de Compra añadida exitosamente.',
      purchaseOrder: newPurchaseOrder,
    };
  } catch (error) {
    console.error('Error al añadir Orden de Compra (simulado):', error);
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

  try {
    // TODO: Lógica para actualizar en la base de datos MySQL
    const index = DUMMY_PURCHASE_ORDERS_DB.findIndex(po => po.id === validatedFields.data.id);
    if (index === -1) {
      return { success: false, message: 'Orden de Compra no encontrada.' };
    }
    DUMMY_PURCHASE_ORDERS_DB[index] = { ...DUMMY_PURCHASE_ORDERS_DB[index], ...validatedFields.data };
    console.log('Orden de Compra actualizada (simulado):', DUMMY_PURCHASE_ORDERS_DB[index]);
    
    revalidatePath('/purchases');
    return {
      success: true,
      message: 'Orden de Compra actualizada exitosamente.',
      purchaseOrder: DUMMY_PURCHASE_ORDERS_DB[index],
    };
  } catch (error) {
    console.error('Error al actualizar Orden de Compra (simulado):', error);
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

  try {
    // TODO: Lógica para eliminar de la base de datos MySQL
    const initialLength = DUMMY_PURCHASE_ORDERS_DB.length;
    DUMMY_PURCHASE_ORDERS_DB = DUMMY_PURCHASE_ORDERS_DB.filter(po => po.id !== poId);
    
    if (DUMMY_PURCHASE_ORDERS_DB.length === initialLength) {
        return { success: false, message: 'Orden de Compra no encontrada para eliminar.' };
    }
    console.log('Orden de Compra eliminada (simulado), ID:', poId);

    revalidatePath('/purchases');
    return {
      success: true,
      message: 'Orden de Compra eliminada exitosamente.',
    };
  } catch (error) {
    console.error('Error al eliminar Orden de Compra (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar Orden de Compra.',
      errors: { general: ['No se pudo eliminar la orden de compra.'] },
    };
  }
}

// Función para obtener datos (simulada)
export async function getPurchaseOrders() {
  // TODO: Lógica para obtener Órdenes de Compra de la base de datos MySQL
  console.log('Obteniendo Órdenes de Compra (simulado)');
  return DUMMY_PURCHASE_ORDERS_DB;
}
