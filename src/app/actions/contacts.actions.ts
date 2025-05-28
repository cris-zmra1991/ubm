
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '../../lib/db'; // Ajustado a ruta relativa
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ContactSchema } from '../schemas/contacts.schemas';


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
    // TODO: SQL - CREATE TABLE contacts (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, phone VARCHAR(50) NOT NULL, type ENUM('Cliente', 'Proveedor', 'Prospecto') NOT NULL, company VARCHAR(255), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
    // Nota: El constraint UNIQUE en email se eliminó de la base de datos según solicitud.
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
    // TODO: SQL - UPDATE contacts SET ... WHERE id = ?
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
    // TODO: SQL - DELETE FROM contacts WHERE id = ?
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

export async function getContacts(filter?: { type?: 'Cliente' | 'Proveedor' | 'Prospecto' }): Promise<(ContactFormInput & { id: string })[]> {
  if (!pool) {
    console.error('Error: Connection pool not available in getContacts.');
    return [];
  }
  try {
    let query = 'SELECT id, name, email, phone, type, company FROM contacts';
    const queryParams: string[] = [];

    if (filter?.type) {
      query += ' WHERE type = ?';
      queryParams.push(filter.type);
    }
    query += ' ORDER BY name ASC';

    const [rows] = await pool.query<RowDataPacket[]>(query, queryParams);
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
    })) as (ContactFormInput & { id: string })[];
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
    // TODO: SQL - Asegúrate de que la tabla 'contacts' tenga una columna 'created_at' de tipo TIMESTAMP o DATE.
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

    