
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

// TODO: SQL - CREATE TABLE para contactos
// CREATE TABLE contacts (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   name VARCHAR(255) NOT NULL,
//   email VARCHAR(255) NOT NULL UNIQUE,
//   phone VARCHAR(50) NOT NULL,
//   type ENUM('Cliente', 'Proveedor', 'Prospecto') NOT NULL,
//   company VARCHAR(255),
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
//   -- avatarUrl y lastInteraction se pueden añadir si es necesario,
//   -- avatarUrl podría ser un TEXT o VARCHAR(2048)
//   -- lastInteraction podría ser un TIMESTAMP nullable
// );

export const ContactSchema = z.object({
  id: z.string().optional(), // MySQL auto-incrementará, pero lo necesitamos para update/delete
  name: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('Correo electrónico inválido.'),
  phone: z.string().min(1, 'El teléfono es requerido.'),
  type: z.enum(['Cliente', 'Proveedor', 'Prospecto'], {
    errorMap: () => ({ message: 'Selecciona un tipo de contacto válido.' }),
  }),
  company: z.string().optional(),
});

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
  contact?: ContactFormInput & { id: string }; // Para devolver el contacto creado/actualizado
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
    // TODO: SQL - Insertar contacto en la base de datos MySQL
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
    // Manejar error de email duplicado (MySQL error code 1062)
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El correo electrónico ya existe.', errors: { email: ['Este correo electrónico ya está registrado.'] } };
    }
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
    // TODO: SQL - Actualizar contacto en la base de datos MySQL
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
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        return { success: false, message: 'Error: El correo electrónico ya existe para otro contacto.', errors: { email: ['Este correo electrónico ya está registrado para otro contacto.'] } };
    }
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
    // TODO: SQL - Eliminar contacto de la base de datos MySQL
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
    return []; // Devolver array vacío o manejar error de forma apropiada
  }
  try {
    // TODO: SQL - Obtener contactos de la base de datos MySQL
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, email, phone, type, company FROM contacts ORDER BY name ASC');
    // Convertir id a string para que coincida con ContactFormInput y el frontend
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
    })) as ContactFormInput[];
  } catch (error) {
    console.error('Error al obtener contactos (MySQL):', error);
    return []; // Devolver array vacío en caso de error
  }
}
