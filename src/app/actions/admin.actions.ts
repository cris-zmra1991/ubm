
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

// Esquema para Información de la Empresa
export const CompanyInfoSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
  companyEmail: z.string().email('Correo electrónico inválido.'),
  companyAddress: z.string().min(1, 'La dirección es requerida.'),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  timezone: z.string().min(1, 'La zona horaria es requerida.'),
});
export type CompanyInfoFormInput = z.infer<typeof CompanyInfoSchema>;

// Esquema para Usuarios
export const UserSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email('Correo electrónico inválido.'),
  role: z.enum(["Administrador", "Gerente", "Usuario"]),
  status: z.enum(["Activo", "Inactivo"]).default("Activo"),
  // La contraseña se manejaría de forma más segura en una implementación real (hash, etc.)
  // Para simulación, no la incluimos directamente en el update/add salvo para creación si es necesario
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional(), // Opcional para edición
});
export type UserFormInput = z.infer<typeof UserSchema>;

// Esquema para Configuración de Seguridad
export const SecuritySettingsSchema = z.object({
  mfaEnabled: z.boolean().default(false),
  passwordPolicy: z.enum(['simple', 'medium', 'strong']),
  sessionTimeout: z.coerce.number().int().min(5, 'El tiempo de sesión debe ser al menos 5 minutos.'),
});
export type SecuritySettingsFormInput = z.infer<typeof SecuritySettingsSchema>;

// Esquema para Configuración de Notificaciones
export const NotificationSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean().default(true),
  newSaleNotify: z.boolean().default(true),
  lowStockNotify: z.boolean().default(true),
});
export type NotificationSettingsFormInput = z.infer<typeof NotificationSettingsSchema>;


export interface AdminActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any; 
  data?: T;
}

// --- Simulación de "Base de Datos" para configuraciones y usuarios ---
let DUMMY_COMPANY_INFO: CompanyInfoFormInput = {
  companyName: "Unified Business Solutions",
  companyEmail: "contact@ubm.com",
  companyAddress: "123 Main Street, Business City, BC 12345",
  currency: "EUR",
  timezone: "Europe/Paris",
};

let DUMMY_USERS_DB: (UserFormInput & { lastLogin?: string })[] = [ // lastLogin solo para display
  { id: "1", username: "johndoe", email: "john.doe@example.com", role: "Administrador", status: "Activo", lastLogin: "2024-07-22 10:00 AM" },
  { id: "2", username: "janesmith", email: "jane.smith@example.com", role: "Gerente", status: "Activo", lastLogin: "2024-07-21 03:00 PM" },
];
let nextUserId = 3;

let DUMMY_SECURITY_SETTINGS: SecuritySettingsFormInput = {
  mfaEnabled: false,
  passwordPolicy: "medium",
  sessionTimeout: 30,
};

let DUMMY_NOTIFICATION_SETTINGS: NotificationSettingsFormInput = {
  emailNotificationsEnabled: true,
  newSaleNotify: true,
  lowStockNotify: true,
};


// --- Acciones para Configuración General ---
export async function updateCompanyInfo(
  data: CompanyInfoFormInput
): Promise<AdminActionResponse<CompanyInfoFormInput>> {
  const validatedFields = CompanyInfoSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  try {
    // TODO: Lógica para guardar en tabla de configuración de MySQL (o similar)
    DUMMY_COMPANY_INFO = validatedFields.data;
    console.log('Información de empresa actualizada (simulado):', DUMMY_COMPANY_INFO);
    revalidatePath('/admin', 'layout');
    return { success: true, message: 'Información de la empresa actualizada.', data: DUMMY_COMPANY_INFO };
  } catch (error) {
    return { success: false, message: 'Error al actualizar información.', errors: { general: ['Error del servidor.'] } };
  }
}
export async function getCompanyInfo(): Promise<CompanyInfoFormInput> {
  // TODO: Lógica para obtener de MySQL
  return DUMMY_COMPANY_INFO;
}

// --- Acciones para Gestión de Usuarios ---
export async function addUser(
  data: UserFormInput
): Promise<AdminActionResponse<UserFormInput>> {
  const validatedFields = UserSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  try {
    // TODO: Lógica para crear usuario en MySQL (hashear contraseña, etc.)
    const newUser = { ...validatedFields.data, id: String(nextUserId++) };
    // Eliminar contraseña del objeto que se guarda en DUMMY_USERS_DB si no se quiere simular su guardado
    // const { password, ...userToStore } = newUser; DUMMY_USERS_DB.push(userToStore);
    DUMMY_USERS_DB.push(newUser); 
    console.log('Usuario añadido (simulado):', newUser);
    revalidatePath('/admin', 'layout');
    return { success: true, message: 'Usuario añadido exitosamente.', data: newUser };
  } catch (error) {
    return { success: false, message: 'Error al añadir usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function updateUser(
  data: UserFormInput
): Promise<AdminActionResponse<UserFormInput>> {
  if (!data.id) return { success: false, message: 'ID de usuario requerido.'};
  // Para actualizar, la contraseña es opcional. Si se provee, se actualiza.
  const updateSchema = data.password ? UserSchema : UserSchema.omit({ password: true });
  const validatedFields = updateSchema.safeParse(data);

  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  try {
    // TODO: Lógica para actualizar usuario en MySQL (si se cambia contraseña, hashear)
    const index = DUMMY_USERS_DB.findIndex(u => u.id === validatedFields.data.id);
    if (index === -1) return { success: false, message: 'Usuario no encontrado.' };
    
    const updatedData = { ...DUMMY_USERS_DB[index], ...validatedFields.data };
    // Si la contraseña no se proporcionó en la actualización, mantener la anterior (no relevante para simulación sin hash)
    if (!validatedFields.data.password) {
      // delete updatedData.password; // O mantener el valor existente si lo tuvieras
    }

    DUMMY_USERS_DB[index] = updatedData;
    console.log('Usuario actualizado (simulado):', DUMMY_USERS_DB[index]);
    revalidatePath('/admin', 'layout');
    return { success: true, message: 'Usuario actualizado.', data: DUMMY_USERS_DB[index] };
  } catch (error) {
    return { success: false, message: 'Error al actualizar usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteUser(userId: string): Promise<AdminActionResponse<null>> {
 try {
    // TODO: Lógica para eliminar usuario en MySQL (o marcar como inactivo)
    DUMMY_USERS_DB = DUMMY_USERS_DB.filter(u => u.id !== userId);
    console.log('Usuario eliminado (simulado), ID:', userId);
    revalidatePath('/admin', 'layout');
    return { success: true, message: 'Usuario eliminado.' };
  } catch (error) {
    return { success: false, message: 'Error al eliminar usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getUsers(): Promise<UserFormInput[]> {
  // TODO: Lógica para obtener usuarios de MySQL
  // No devolver contraseñas!
  return DUMMY_USERS_DB.map(u => { const {password, ...user} = u; return user; });
}


// --- Acciones para Configuración de Seguridad ---
export async function updateSecuritySettings(
  data: SecuritySettingsFormInput
): Promise<AdminActionResponse<SecuritySettingsFormInput>> {
  const validatedFields = SecuritySettingsSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  try {
    // TODO: Lógica para guardar en MySQL
    DUMMY_SECURITY_SETTINGS = validatedFields.data;
    console.log('Config. seguridad actualizada (simulado):', DUMMY_SECURITY_SETTINGS);
    revalidatePath('/admin', 'layout');
    return { success: true, message: 'Configuración de seguridad actualizada.', data: DUMMY_SECURITY_SETTINGS };
  } catch (error) {
    return { success: false, message: 'Error al actualizar config. seguridad.', errors: { general: ['Error del servidor.'] } };
  }
}
export async function getSecuritySettings(): Promise<SecuritySettingsFormInput> {
  // TODO: Lógica para obtener de MySQL
  return DUMMY_SECURITY_SETTINGS;
}

// --- Acciones para Configuración de Notificaciones ---
export async function updateNotificationSettings(
  data: NotificationSettingsFormInput
): Promise<AdminActionResponse<NotificationSettingsFormInput>> {
  const validatedFields = NotificationSettingsSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  try {
    // TODO: Lógica para guardar en MySQL
    DUMMY_NOTIFICATION_SETTINGS = validatedFields.data;
    console.log('Config. notificaciones actualizada (simulado):', DUMMY_NOTIFICATION_SETTINGS);
    revalidatePath('/admin', 'layout');
    return { success: true, message: 'Configuración de notificaciones actualizada.', data: DUMMY_NOTIFICATION_SETTINGS };
  } catch (error) {
    return { success: false, message: 'Error al actualizar config. notificaciones.', errors: { general: ['Error del servidor.'] } };
  }
}
export async function getNotificationSettings(): Promise<NotificationSettingsFormInput> {
  // TODO: Lógica para obtener de MySQL
  return DUMMY_NOTIFICATION_SETTINGS;
}
