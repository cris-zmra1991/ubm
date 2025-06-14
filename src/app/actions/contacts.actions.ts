
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { ContactSchema } from '@/app/schemas/contacts.schemas';


export type ContactFormInput = z.infer<typeof ContactSchema>;

export interface ContactActionResponse {
  success: boolean;
  message: string;
  errors?: {
    name?: string[];
    email?: string[];
    phone?: string[];
    type?: string[];
    company?: string[];
    general?: string[];
  };
  contact?: ContactFormInput & { id: string };
}


export async function addContact(
  data: ContactFormInput
): Promise<ContactActionResponse> {
  const validatedFields = ContactSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in addContact.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { name, email, phone, type, company } = validatedFields.data;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO contacts (name, email, phone, type, company) VALUES (?, ?, ?, ?, ?)',
      [name, email, phone, type, company || null]
    );

    if (result.affectedRows > 0) {
      const newContactId = result.insertId.toString();
      revalidatePath('/contacts');
      return {
        success: true,
        message: 'Contacto añadido exitosamente.',
        contact: { ...validatedFields.data, id: newContactId },
      };
    } else {
      return { success: false, message: 'No se pudo añadir el contacto.' };
    }
  } catch (error: any) {
    console.error('Error al añadir contacto (MySQL):', error);
    // Se elimina la verificación específica de ER_DUP_ENTRY para el email,
    // ya que la restricción UNIQUE en la base de datos se habrá eliminado.
    // Cualquier otro error de duplicado (ej. si hubiera un ID manual duplicado,
    // aunque aquí es AUTO_INCREMENT) o error general se capturará abajo.
    return {
      success: false,
      message: 'Error del servidor al añadir contacto.',
      errors: { general: ['No se pudo añadir el contacto. Inténtalo de nuevo.'] },
    };
  }
}

export async function updateContact(
  data: ContactFormInput
): Promise<ContactActionResponse> {
  if (!data.id) {
    return { success: false, message: 'ID de contacto requerido para actualizar.' };
  }
  const validatedFields = ContactSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Error de validación.',
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in updateContact.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  const { id, name, email, phone, type, company } = validatedFields.data;

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'UPDATE contacts SET name = ?, email = ?, phone = ?, type = ?, company = ? WHERE id = ?',
      [name, email, phone, type, company || null, id]
    );

    if (result.affectedRows > 0) {
      revalidatePath('/contacts');
      return {
        success: true,
        message: 'Contacto actualizado exitosamente.',
        contact: { ...validatedFields.data, id: id! },
      };
    } else {
      return { success: false, message: 'Contacto no encontrado o sin cambios.' };
    }
  } catch (error: any) {
    console.error('Error al actualizar contacto (MySQL):', error);
    // Se elimina la verificación específica de ER_DUP_ENTRY para el email
    return {
      success: false,
      message: 'Error del servidor al actualizar contacto.',
       errors: { general: ['No se pudo actualizar el contacto. Inténtalo de nuevo.'] },
    };
  }
}

export async function deleteContact(
  contactId: string
): Promise<ContactActionResponse> {
  if (!contactId) {
    return { success: false, message: 'ID de contacto requerido para eliminar.' };
  }

  if (!pool) {
    console.error('Error: Connection pool not available in deleteContact.');
    return { success: false, message: 'Error del servidor: No se pudo conectar a la base de datos.' };
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM contacts WHERE id = ?',
      [contactId]
    );

    if (result.affectedRows > 0) {
        revalidatePath('/contacts');
        return {
          success: true,
          message: 'Contacto eliminado exitosamente.',
        };
    } else {
        return { success: false, message: 'Contacto no encontrado para eliminar.' };
    }
  } catch (error) {
    console.error('Error al eliminar contacto (MySQL):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar contacto.',
      errors: { general: ['No se pudo eliminar el contacto. Inténtalo de nuevo.'] },
    };
  }
}

export async function getContacts(): Promise<ContactFormInput[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getContacts.');
    return [];
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, email, phone, type, company FROM contacts ORDER BY name ASC');
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
    })) as ContactFormInput[];
  } catch (error) {
    console.error('Error al obtener contactos (MySQL):', error);
    return [];
  }
}

export async function getNewClientsThisMonthCount(): Promise<number> {
  if (!pool) {
    console.error('Error: Connection pool not available in getNewClientsThisMonthCount.');
    return 0;
  }
  try {
    // SQL - Obtener contador de nuevos clientes de este mes (ej. últimos 30 días)
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT COUNT(id) as count FROM contacts WHERE type = 'Cliente' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)"
    );
    if (rows.length > 0 && rows[0].count) {
      return parseInt(rows[0].count, 10);
    }
    return 0;
  } catch (error) {
    console.error('Error al obtener contador de nuevos clientes (MySQL):', error);
    return 0;
  }
}
