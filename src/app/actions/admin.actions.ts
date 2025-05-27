
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import {
  CompanyInfoSchema,
  UserSchema,
  SecuritySettingsSchema,
  NotificationSettingsSchema
} from '@/app/schemas/admin.schemas';

// --- Esquemas de SQL (Recordatorios) ---
// CREATE TABLE company_info (id INT PRIMARY KEY DEFAULT 1, ...);
// CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) NOT NULL UNIQUE, ..., role_id INT, FOREIGN KEY (role_id) REFERENCES roles(id) ... );
// CREATE TABLE security_settings (id INT PRIMARY KEY DEFAULT 1, ...);
// CREATE TABLE notification_settings (id INT PRIMARY KEY DEFAULT 1, ...);
// CREATE TABLE roles (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT);
// CREATE TABLE permissions (id INT AUTO_INCREMENT PRIMARY KEY, action_name VARCHAR(255) NOT NULL UNIQUE, module VARCHAR(100) NOT NULL, description TEXT);
// CREATE TABLE role_permissions (role_id INT, permission_id INT, PRIMARY KEY (role_id, permission_id), FOREIGN KEY...);


export type CompanyInfoFormInput = z.infer<typeof CompanyInfoSchema>;
export type UserFormInput = z.infer<typeof UserSchema>;
export type SecuritySettingsFormInput = z.infer<typeof SecuritySettingsSchema>;
export type NotificationSettingsFormInput = z.infer<typeof NotificationSettingsSchema>;


export interface AdminActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any; 
  data?: T;
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
    // SQL - Actualizar o insertar información de la empresa (asumiendo id=1 para una única fila)
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
    // SQL - Obtener información de la empresa
    const [rows] = await pool.query<RowDataPacket[]>('SELECT companyName, companyEmail, companyAddress, currency, timezone FROM company_info WHERE id = 1');
    if (rows.length > 0) {
      return rows[0] as CompanyInfoFormInput;
    }
    // Devuelve valores por defecto si no hay nada en la BD, pero asegúrate de que exista una fila con id=1.
    return { 
        companyName: "Mi Empresa Ejemplo", companyEmail: "email@ejemplo.com", companyAddress: "123 Calle Falsa", 
        currency: "EUR", timezone: "Europe/Madrid" // O tu zona por defecto
    };
  } catch (error) {
    console.error('Error al obtener información de empresa (MySQL):', error);
    return null;
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
  
  const { username, email, role_id, status, password } = validatedFields.data;
  if (!password || password.length < 6) { // TODO: Ajustar política de contraseñas según SecuritySettings
    return { success: false, message: 'La contraseña es requerida y debe tener al menos 6 caracteres.', errors: { password: ['La contraseña es requerida y debe tener al menos 6 caracteres.'] } };
  }
  
  try {
    // TODO: SQL - Hashear contraseña antes de guardarla
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);
    
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, email, role_id, status, password_hash) VALUES (?, ?, ?, ?, ?)',
      [username, email, role_id, status, password_hash]
    );
    if (result.affectedRows > 0) {
        const newUserId = result.insertId.toString();
        revalidatePath('/admin', 'layout');
        const { password: _p, ...userData } = validatedFields.data; 
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
  
  // Si no se provee contraseña, no la validamos ni actualizamos
  const schemaToUse = data.password && data.password.length > 0 ? UserSchema : UserSchema.omit({ password: true });
  const validatedFields = schemaToUse.safeParse(data);

  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };

  const { id, username, email, role_id, status, password } = validatedFields.data;
  try {
    let query: string;
    let queryParams: any[];

    if (password && password.length > 0) {
      // TODO: Ajustar política de contraseñas según SecuritySettings
      if (password.length < 6) {
        return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.', errors: { password: ['La nueva contraseña debe tener al menos 6 caracteres.']}};
      }
      // TODO: SQL - Hashear nueva contraseña
      const salt = bcrypt.genSaltSync(10);
      const new_password_hash = bcrypt.hashSync(password, salt);
      query = 'UPDATE users SET username = ?, email = ?, role_id = ?, status = ?, password_hash = ? WHERE id = ?';
      queryParams = [username, email, role_id, status, new_password_hash, id];
    } else {
      query = 'UPDATE users SET username = ?, email = ?, role_id = ?, status = ? WHERE id = ?';
      queryParams = [username, email, role_id, status, id];
    }
    
    const [result] = await pool.query<ResultSetHeader>(query, queryParams);
    if (result.affectedRows > 0) {
        revalidatePath('/admin', 'layout');
        const { password: _p, ...userData } = validatedFields.data;
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
    // SQL - Eliminar usuario
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

export async function getUsers(): Promise<(UserFormInput & { id: string; role_name?: string; lastLogin?: string })[]> {
  if (!pool) { console.error('DB pool no disponible en getUsers'); return []; }
  try {
    // SQL - Obtener usuarios con el nombre de su rol
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, u.role_id, r.name as role_name, u.status, DATE_FORMAT(u.lastLogin, "%Y-%m-%d %H:%i:%s") as lastLogin 
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.username ASC`
    );
    return rows.map(row => ({
        ...row,
        id: row.id.toString(),
        role_id: row.role_id, 
        role_name: row.role_name,
    })) as (UserFormInput & { id: string; role_name?: string; lastLogin?: string })[];
  } catch (error) {
    console.error('Error al obtener usuarios (MySQL):', error);
    return [];
  }
}

export async function getRoles(): Promise<{ id: number; name: string }[]> {
  if (!pool) { console.error('DB pool no disponible en getRoles'); return []; }
  try {
    // SQL - Obtener todos los roles
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name FROM roles ORDER BY name ASC');
    return rows as { id: number; name: string }[];
  } catch (error) {
    console.error('Error al obtener roles (MySQL):', error);
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
    // SQL - Actualizar o insertar configuración de seguridad (asumiendo id=1)
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
    // SQL - Obtener configuración de seguridad
    const [rows] = await pool.query<RowDataPacket[]>('SELECT mfaEnabled, passwordPolicy, sessionTimeout FROM security_settings WHERE id = 1');
    if (rows.length > 0) {
      return { ...rows[0], mfaEnabled: Boolean(rows[0].mfaEnabled), sessionTimeout: Number(rows[0].sessionTimeout) } as SecuritySettingsFormInput;
    }
    // Devuelve valores por defecto si no hay nada en la BD, pero asegúrate de que exista una fila con id=1.
    return { mfaEnabled: false, passwordPolicy: "medium", sessionTimeout: 30 }; 
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
    // SQL - Actualizar o insertar configuración de notificaciones (asumiendo id=1)
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
    // SQL - Obtener configuración de notificaciones
    const [rows] = await pool.query<RowDataPacket[]>('SELECT emailNotificationsEnabled, newSaleNotify, lowStockNotify FROM notification_settings WHERE id = 1');
    if (rows.length > 0) {
      return { 
          ...rows[0], 
          emailNotificationsEnabled: Boolean(rows[0].emailNotificationsEnabled),
          newSaleNotify: Boolean(rows[0].newSaleNotify),
          lowStockNotify: Boolean(rows[0].lowStockNotify),
      } as NotificationSettingsFormInput;
    }
    // Devuelve valores por defecto si no hay nada en la BD, pero asegúrate de que exista una fila con id=1.
    return { emailNotificationsEnabled: true, newSaleNotify: true, lowStockNotify: true }; 
  } catch (error) {
    console.error('Error al obtener config. notificaciones (MySQL):', error);
    return null;
  }
}
