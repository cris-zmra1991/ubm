
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

// TODO: SQL - CREATE TABLE para Información de la Empresa (company_info)
// Esta tabla usualmente tendrá una sola fila.
// CREATE TABLE company_info (
//   id INT PRIMARY KEY DEFAULT 1, -- Solo una fila
//   companyName VARCHAR(255) NOT NULL,
//   companyEmail VARCHAR(255) NOT NULL,
//   companyAddress TEXT NOT NULL,
//   currency ENUM('EUR', 'USD', 'GBP') NOT NULL,
//   timezone VARCHAR(100) NOT NULL,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   CONSTRAINT single_row CHECK (id = 1) -- Asegura una sola fila si tu MySQL lo soporta
// );
// -- Inserta una fila inicial si la tabla está vacía:
// INSERT INTO company_info (id, companyName, companyEmail, companyAddress, currency, timezone)
// VALUES (1, 'Nombre de Empresa Inicial', 'email@inicial.com', 'Dirección Inicial', 'EUR', 'Europe/Paris')
// ON DUPLICATE KEY UPDATE companyName=companyName; -- Para evitar error si ya existe

// TODO: SQL - CREATE TABLE para Usuarios (users) - Ya definido en auth.actions.ts, asegurarse que coincida.
// CREATE TABLE users (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   username VARCHAR(255) NOT NULL UNIQUE,
//   email VARCHAR(255) NOT NULL UNIQUE,
//   password_hash VARCHAR(255) NOT NULL, -- Almacenar hash, no la contraseña
//   role ENUM('Administrador', 'Gerente', 'Usuario') NOT NULL DEFAULT 'Usuario',
//   status ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
//   lastLogin TIMESTAMP NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
// );

// TODO: SQL - CREATE TABLE para Configuración de Seguridad (security_settings)
// CREATE TABLE security_settings (
//   id INT PRIMARY KEY DEFAULT 1,
//   mfaEnabled BOOLEAN DEFAULT FALSE,
//   passwordPolicy ENUM('simple', 'medium', 'strong') DEFAULT 'medium',
//   sessionTimeout INT DEFAULT 30, -- en minutos
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   CONSTRAINT single_row_sec CHECK (id = 1)
// );
// INSERT INTO security_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id;

// TODO: SQL - CREATE TABLE para Configuración de Notificaciones (notification_settings)
// CREATE TABLE notification_settings (
//   id INT PRIMARY KEY DEFAULT 1,
//   emailNotificationsEnabled BOOLEAN DEFAULT TRUE,
//   newSaleNotify BOOLEAN DEFAULT TRUE,
//   lowStockNotify BOOLEAN DEFAULT TRUE,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   CONSTRAINT single_row_notif CHECK (id = 1)
// );
// INSERT INTO notification_settings (id) VALUES (1) ON DUPLICATE KEY UPDATE id=id;


export const CompanyInfoSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
  companyEmail: z.string().email('Correo electrónico inválido.'),
  companyAddress: z.string().min(1, 'La dirección es requerida.'),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  timezone: z.string().min(1, 'La zona horaria es requerida.'),
});
export type CompanyInfoFormInput = z.infer<typeof CompanyInfoSchema>;

export const UserSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email('Correo electrónico inválido.'),
  role: z.enum(["Administrador", "Gerente", "Usuario"]),
  status: z.enum(["Activo", "Inactivo"]).default("Activo"),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional(),
});
export type UserFormInput = z.infer<typeof UserSchema>;

export const SecuritySettingsSchema = z.object({
  mfaEnabled: z.boolean().default(false),
  passwordPolicy: z.enum(['simple', 'medium', 'strong']),
  sessionTimeout: z.coerce.number().int().min(5, 'El tiempo de sesión debe ser al menos 5 minutos.'),
});
export type SecuritySettingsFormInput = z.infer<typeof SecuritySettingsSchema>;

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
  data?: T; // Si es una operación de get, podría ser T. Si es add/update puede ser T & {id: string}
}

// --- Acciones para Configuración General ---
export async function updateCompanyInfo(
  data: CompanyInfoFormInput
): Promise<AdminActionResponse<CompanyInfoFormInput>> {
  const validatedFields = CompanyInfoSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };

  const { companyName, companyEmail, companyAddress, currency, timezone } = validatedFields.data;
  try {
    // TODO: SQL - Actualizar (o insertar si no existe) la información de la empresa en MySQL (tabla con una sola fila, id=1)
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO company_info (id, companyName, companyEmail, companyAddress, currency, timezone) 
       VALUES (1, ?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       companyName = VALUES(companyName), companyEmail = VALUES(companyEmail), companyAddress = VALUES(companyAddress), 
       currency = VALUES(currency), timezone = VALUES(timezone)`,
      [companyName, companyEmail, companyAddress, currency, timezone]
    );

    if (result.affectedRows > 0 || result.insertId > 0) {
        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Información de la empresa actualizada.', data: validatedFields.data };
    }
    return { success: false, message: 'No se pudo actualizar la información de la empresa.' };
  } catch (error) {
    console.error('Error al actualizar información de empresa (MySQL):', error);
    return { success: false, message: 'Error al actualizar información.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getCompanyInfo(): Promise<CompanyInfoFormInput | null> {
  if (!pool) { console.error('DB pool not available in getCompanyInfo'); return null; }
  try {
    // TODO: SQL - Obtener información de la empresa de MySQL (fila con id=1)
    const [rows] = await pool.query<RowDataPacket[]>('SELECT companyName, companyEmail, companyAddress, currency, timezone FROM company_info WHERE id = 1');
    if (rows.length > 0) {
      return rows[0] as CompanyInfoFormInput;
    }
    // Devuelve valores por defecto si no hay nada en la BD para evitar errores en el form
    return { 
        companyName: "Mi Empresa", companyEmail: "email@example.com", companyAddress: "123 Calle Falsa", 
        currency: "EUR", timezone: "Europe/Madrid" 
    };
  } catch (error) {
    console.error('Error al obtener información de empresa (MySQL):', error);
    return null; // O un objeto con valores por defecto
  }
}

// --- Acciones para Gestión de Usuarios ---
export async function addUser(
  data: UserFormInput
): Promise<AdminActionResponse<UserFormInput & {id: string}>> {
  const validatedFields = UserSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
  
  const { username, email, role, status, password } = validatedFields.data;
  if (!password) { // Password es requerido para addUser
    return { success: false, message: 'La contraseña es requerida para nuevos usuarios.', errors: { password: ['La contraseña es requerida.'] } };
  }
  
  try {
    // TODO: SQL - Hashear contraseña antes de guardarla (ej. con bcrypt)
    const password_hash = password; // REEMPLAZAR con el hash real
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, email, role, status, password_hash) VALUES (?, ?, ?, ?, ?)',
      [username, email, role, status, password_hash]
    );
    if (result.affectedRows > 0) {
        const newUserId = result.insertId.toString();
        revalidatePath('/admin', 'layout');
        const { password, ...userData } = validatedFields.data; // No devolver contraseña
        return { success: true, message: 'Usuario añadido exitosamente.', data: { ...userData, id: newUserId } };
    }
    return { success: false, message: 'No se pudo añadir el usuario.' };
  } catch (error: any) {
    console.error('Error al añadir usuario (MySQL):', error);
    if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        const field = error.message.includes('username') ? 'username' : 'email';
        return { success: false, message: `Error: El ${field} ya existe.`, errors: { [field]: [`Este ${field} ya está registrado.`] } };
    }
    return { success: false, message: 'Error al añadir usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function updateUser(
  data: UserFormInput
): Promise<AdminActionResponse<UserFormInput & {id: string}>> {
  if (!data.id) return { success: false, message: 'ID de usuario requerido.'};
  const updateSchema = data.password ? UserSchema : UserSchema.omit({ password: true });
  const validatedFields = updateSchema.safeParse(data);

  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };

  const { id, username, email, role, status, password } = validatedFields.data;
  try {
    let query: string;
    let queryParams: any[];

    if (password) {
      // TODO: SQL - Hashear nueva contraseña
      const new_password_hash = password; // REEMPLAZAR con el hash real
      query = 'UPDATE users SET username = ?, email = ?, role = ?, status = ?, password_hash = ? WHERE id = ?';
      queryParams = [username, email, role, status, new_password_hash, id];
    } else {
      query = 'UPDATE users SET username = ?, email = ?, role = ?, status = ? WHERE id = ?';
      queryParams = [username, email, role, status, id];
    }
    
    const [result] = await pool.query<ResultSetHeader>(query, queryParams);
    if (result.affectedRows > 0) {
        revalidatePath('/admin', 'layout');
        const { password, ...userData } = validatedFields.data;
        return { success: true, message: 'Usuario actualizado.', data: { ...userData, id: id! } };
    }
    return { success: false, message: 'Usuario no encontrado o sin cambios.' };
  } catch (error: any) {
    console.error('Error al actualizar usuario (MySQL):', error);
     if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
        const field = error.message.includes('username') ? 'username' : 'email';
        return { success: false, message: `Error: El ${field} ya existe para otro usuario.`, errors: { [field]: [`Este ${field} ya está registrado para otro usuario.`] } };
    }
    return { success: false, message: 'Error al actualizar usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteUser(userId: string): Promise<AdminActionResponse<null>> {
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
  try {
    // TODO: SQL - Eliminar usuario
    const [result] = await pool.query<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);
    if (result.affectedRows > 0) {
        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Usuario eliminado.' };
    }
    return { success: false, message: 'Usuario no encontrado.' };
  } catch (error) {
    console.error('Error al eliminar usuario (MySQL):', error);
    return { success: false, message: 'Error al eliminar usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getUsers(): Promise<(UserFormInput & { lastLogin?: string })[]> {
  if (!pool) { console.error('DB pool no disponible en getUsers'); return []; }
  try {
    // TODO: SQL - Obtener usuarios, excluyendo password_hash
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, username, email, role, status, DATE_FORMAT(lastLogin, "%Y-%m-%d %H:%i:%s") as lastLogin FROM users ORDER BY username ASC');
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
    })) as (UserFormInput & { lastLogin?: string })[];
  } catch (error) {
    console.error('Error al obtener usuarios (MySQL):', error);
    return [];
  }
}


// --- Acciones para Configuración de Seguridad ---
export async function updateSecuritySettings(
  data: SecuritySettingsFormInput
): Promise<AdminActionResponse<SecuritySettingsFormInput>> {
  const validatedFields = SecuritySettingsSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
  
  const { mfaEnabled, passwordPolicy, sessionTimeout } = validatedFields.data;
  try {
    // TODO: SQL - Actualizar (o insertar si no existe) config. seguridad
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO security_settings (id, mfaEnabled, passwordPolicy, sessionTimeout) VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mfaEnabled = VALUES(mfaEnabled), passwordPolicy = VALUES(passwordPolicy), sessionTimeout = VALUES(sessionTimeout)`,
      [mfaEnabled, passwordPolicy, sessionTimeout]
    );
    if (result.affectedRows > 0 || result.insertId > 0) {
        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Configuración de seguridad actualizada.', data: validatedFields.data };
    }
    return { success: false, message: 'No se pudo actualizar la configuración de seguridad.' };
  } catch (error) {
    console.error('Error al actualizar config. seguridad (MySQL):', error);
    return { success: false, message: 'Error al actualizar config. seguridad.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getSecuritySettings(): Promise<SecuritySettingsFormInput | null> {
  if (!pool) { console.error('DB pool no disponible en getSecuritySettings'); return null; }
  try {
    // TODO: SQL - Obtener config. seguridad
    const [rows] = await pool.query<RowDataPacket[]>('SELECT mfaEnabled, passwordPolicy, sessionTimeout FROM security_settings WHERE id = 1');
    if (rows.length > 0) {
      return { ...rows[0], mfaEnabled: Boolean(rows[0].mfaEnabled) } as SecuritySettingsFormInput;
    }
    return { mfaEnabled: false, passwordPolicy: "medium", sessionTimeout: 30 }; // Valores por defecto
  } catch (error) {
    console.error('Error al obtener config. seguridad (MySQL):', error);
    return null;
  }
}

// --- Acciones para Configuración de Notificaciones ---
export async function updateNotificationSettings(
  data: NotificationSettingsFormInput
): Promise<AdminActionResponse<NotificationSettingsFormInput>> {
  const validatedFields = NotificationSettingsSchema.safeParse(data);
  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };

  const { emailNotificationsEnabled, newSaleNotify, lowStockNotify } = validatedFields.data;
  try {
    // TODO: SQL - Actualizar (o insertar si no existe) config. notificaciones
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO notification_settings (id, emailNotificationsEnabled, newSaleNotify, lowStockNotify) VALUES (1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE emailNotificationsEnabled = VALUES(emailNotificationsEnabled), newSaleNotify = VALUES(newSaleNotify), lowStockNotify = VALUES(lowStockNotify)`,
      [emailNotificationsEnabled, newSaleNotify, lowStockNotify]
    );
     if (result.affectedRows > 0 || result.insertId > 0) {
        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Configuración de notificaciones actualizada.', data: validatedFields.data };
    }
    return { success: false, message: 'No se pudo actualizar la configuración de notificaciones.' };
  } catch (error) {
    console.error('Error al actualizar config. notificaciones (MySQL):', error);
    return { success: false, message: 'Error al actualizar config. notificaciones.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function getNotificationSettings(): Promise<NotificationSettingsFormInput | null> {
  if (!pool) { console.error('DB pool no disponible en getNotificationSettings'); return null; }
  try {
    // TODO: SQL - Obtener config. notificaciones
    const [rows] = await pool.query<RowDataPacket[]>('SELECT emailNotificationsEnabled, newSaleNotify, lowStockNotify FROM notification_settings WHERE id = 1');
    if (rows.length > 0) {
      return { 
          ...rows[0], 
          emailNotificationsEnabled: Boolean(rows[0].emailNotificationsEnabled),
          newSaleNotify: Boolean(rows[0].newSaleNotify),
          lowStockNotify: Boolean(rows[0].lowStockNotify),
      } as NotificationSettingsFormInput;
    }
    return { emailNotificationsEnabled: true, newSaleNotify: true, lowStockNotify: true }; // Valores por defecto
  } catch (error) {
    console.error('Error al obtener config. notificaciones (MySQL):', error);
    return null;
  }
}
