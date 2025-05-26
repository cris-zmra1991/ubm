
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Esquema para la validación de datos de contacto
export const ContactSchema = z.object({
  id: z.string().optional(), // Opcional para la creación, requerido para la actualización
  name: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('Correo electrónico inválido.'),
  phone: z.string().min(1, 'El teléfono es requerido.'),
  type: z.enum(['Cliente', 'Proveedor', 'Prospecto'], {
    errorMap: () => ({ message: 'Selecciona un tipo de contacto válido.' }),
  }),
  company: z.string().optional(),
  // avatarUrl se manejará por separado o se omitirá en la simulación simple
  // lastInteraction se actualizará automáticamente o se omitirá
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
  contact?: ContactFormInput; // Para devolver el contacto creado/actualizado si es necesario
}

// Simulación de base de datos en memoria (solo para demostración)
// En una aplicación real, esto interactuaría con MySQL.
let DUMMY_CONTACTS_DB: ContactFormInput[] = [
  { id: "1", name: "Alice Wonderland", email: "alice@example.com", phone: "555-1234", type: "Cliente", company: "Wonderland Inc." },
  { id: "2", name: "Bob The Builder", email: "bob@example.com", phone: "555-5678", type: "Proveedor", company: "BuildIt Co." },
];
let nextId = 3;


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

  try {
    const newContact = { ...validatedFields.data, id: String(nextId++) };
    // TODO: Lógica para insertar en la base de datos MySQL
    DUMMY_CONTACTS_DB.push(newContact);
    console.log('Contacto añadido (simulado):', newContact);

    revalidatePath('/contacts'); // Revalida la caché de la página de contactos
    return {
      success: true,
      message: 'Contacto añadido exitosamente.',
      contact: newContact,
    };
  } catch (error) {
    console.error('Error al añadir contacto (simulado):', error);
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

  try {
    // TODO: Lógica para actualizar en la base de datos MySQL
    const index = DUMMY_CONTACTS_DB.findIndex(c => c.id === validatedFields.data.id);
    if (index === -1) {
      return { success: false, message: 'Contacto no encontrado.' };
    }
    DUMMY_CONTACTS_DB[index] = { ...DUMMY_CONTACTS_DB[index], ...validatedFields.data };
    console.log('Contacto actualizado (simulado):', DUMMY_CONTACTS_DB[index]);
    
    revalidatePath('/contacts');
    return {
      success: true,
      message: 'Contacto actualizado exitosamente.',
      contact: DUMMY_CONTACTS_DB[index],
    };
  } catch (error) {
    console.error('Error al actualizar contacto (simulado):', error);
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

  try {
    // TODO: Lógica para eliminar de la base de datos MySQL
    const initialLength = DUMMY_CONTACTS_DB.length;
    DUMMY_CONTACTS_DB = DUMMY_CONTACTS_DB.filter(c => c.id !== contactId);
    
    if (DUMMY_CONTACTS_DB.length === initialLength) {
        return { success: false, message: 'Contacto no encontrado para eliminar.' };
    }
    console.log('Contacto eliminado (simulado), ID:', contactId);

    revalidatePath('/contacts');
    return {
      success: true,
      message: 'Contacto eliminado exitosamente.',
    };
  } catch (error) {
    console.error('Error al eliminar contacto (simulado):', error);
    return {
      success: false,
      message: 'Error del servidor al eliminar contacto.',
      errors: { general: ['No se pudo eliminar el contacto. Inténtalo de nuevo.'] },
    };
  }
}

// Esta función es para obtener los datos iniciales, en un backend real esto consultaría la DB.
// Por ahora, la página de contactos usa datos hardcoded.
// Si la página de contactos fuera un Server Component que fetchea datos, esta función sería útil.
export async function getContacts() {
  // TODO: Lógica para obtener contactos de la base de datos MySQL
  console.log('Obteniendo contactos (simulado)');
  return DUMMY_CONTACTS_DB;
}
