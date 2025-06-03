
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { pool } from '@/lib/db';
import type { ResultSetHeader, RowDataPacket, Connection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import {
  CompanyInfoSchema,
  UserSchema,
  SecuritySettingsSchema,
  NotificationSettingsSchema,
  RolePermissionSchema
} from '@/app/schemas/admin.schemas';

// --- Esquemas de SQL (Recordatorios) ---
// CREATE TABLE company_info (id INT PRIMARY KEY DEFAULT 1, ...);
// CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(255) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, ..., role_id INT, FOREIGN KEY (role_id) REFERENCES roles(id) ... );
// CREATE TABLE security_settings (id INT PRIMARY KEY DEFAULT 1, ...);
// CREATE TABLE notification_settings (id INT PRIMARY KEY DEFAULT 1, ...);
// CREATE TABLE roles (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE, description TEXT);
// CREATE TABLE permissions (id INT AUTO_INCREMENT PRIMARY KEY, action_name VARCHAR(255) NOT NULL UNIQUE, module VARCHAR(100) NOT NULL, description TEXT);
// CREATE TABLE role_permissions (role_id INT, permission_id INT, PRIMARY KEY (role_id, permission_id), FOREIGN KEY...);


export type CompanyInfoFormInput = z.infer<typeof CompanyInfoSchema>;
export type UserFormInput = z.infer<typeof UserSchema>;
export type SecuritySettingsFormInput = z.infer<typeof SecuritySettingsSchema>;
export type NotificationSettingsFormInput = z.infer<typeof NotificationSettingsSchema>;
export type RolePermissionFormInput = z.infer<typeof RolePermissionSchema>;


export interface AdminActionResponse<T> {
  success: boolean;
  message: string;
  errors?: any;
  data?: T;
}

export interface Permission {
    id: number;
    action_name: string;
    module: string;
    description: string | null;
}

export interface Role {
    id: number;
    name: string;
    description?: string | null;
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

  const { companyName, companyEmail, companyAddress, currency, timezone, defaultPurchasePayableAccountId, defaultAccountsReceivableId, defaultCashBankAccountId } = validatedFields.data;
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO company_info (id, companyName, companyEmail, companyAddress, currency, timezone, default_purchase_payable_account_id, default_accounts_receivable_id, default_cash_bank_account_id)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       companyName = VALUES(companyName), companyEmail = VALUES(companyEmail), companyAddress = VALUES(companyAddress),
       currency = VALUES(currency), timezone = VALUES(timezone), 
       default_purchase_payable_account_id = VALUES(default_purchase_payable_account_id),
       default_accounts_receivable_id = VALUES(default_accounts_receivable_id),
       default_cash_bank_account_id = VALUES(default_cash_bank_account_id)`,
      [companyName, companyEmail, companyAddress, currency, timezone, defaultPurchasePayableAccountId, defaultAccountsReceivableId, defaultCashBankAccountId]
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
  if (!pool) { console.error('DB pool no disponible en getCompanyInfo'); return null; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT companyName, companyEmail, companyAddress, currency, timezone, default_purchase_payable_account_id as defaultPurchasePayableAccountId, default_accounts_receivable_id as defaultAccountsReceivableId, default_cash_bank_account_id as defaultCashBankAccountId FROM company_info WHERE id = 1');
    if (rows.length > 0) {
      return rows[0] as CompanyInfoFormInput;
    }
    return {
        companyName: "Mi Empresa Ejemplo", companyEmail: "email@ejemplo.com", companyAddress: "123 Calle Falsa",
        currency: "EUR", timezone: "Europe/Madrid",
        defaultPurchasePayableAccountId: null,
        defaultAccountsReceivableId: null,
        defaultCashBankAccountId: null,
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

  const { name, username, email, role_id, status, password } = validatedFields.data;
  if (!password || password.length < 6) { 
    return { success: false, message: 'La contraseña es requerida y debe tener al menos 6 caracteres.', errors: { password: ['La contraseña es requerida y debe tener al menos 6 caracteres.'] } };
  }

  try {
    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, name, email, role_id, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
      [username, name, email, role_id, status, password_hash]
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
        const field = error.message.includes('username') ? 'username' : error.message.includes('email') ? 'email' : 'unknown';
        return { success: false, message: `Error: El ${field} ya existe.`, errors: { [field]: [`Este ${field} ya está registrado.`] } };
    }
    return { success: false, message: 'Error al añadir usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function updateUser(
  data: UserFormInput
): Promise<AdminActionResponse<UserFormInput & {id: string}>> {
  if (!data.id) return { success: false, message: 'ID de usuario requerido.'};

  const schemaToUse = data.password && data.password.length > 0 ? UserSchema : UserSchema.omit({ password: true });
  const validatedFields = schemaToUse.safeParse(data);

  if (!validatedFields.success) {
    return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
  }
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };

  const { id, name, username, email, role_id, status, password } = validatedFields.data;
  try {
    let query: string;
    let queryParams: any[];

    if (password && password.length > 0) {
      if (password.length < 6) {
        return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.', errors: { password: ['La nueva contraseña debe tener al menos 6 caracteres.']}};
      }
      const salt = bcrypt.genSaltSync(10);
      const new_password_hash = bcrypt.hashSync(password, salt);
      query = 'UPDATE users SET username = ?, name = ?, email = ?, role_id = ?, status = ?, password_hash = ? WHERE id = ?';
      queryParams = [username, name, email, role_id, status, new_password_hash, id];
    } else {
      query = 'UPDATE users SET username = ?, name = ?, email = ?, role_id = ?, status = ? WHERE id = ?';
      queryParams = [username, name, email, role_id, status, id];
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
        const field = error.message.includes('username') ? 'username' : error.message.includes('email') ? 'email' : 'unknown';
        return { success: false, message: `Error: El ${field} ya existe para otro usuario.`, errors: { [field]: [`Este ${field} ya está registrado para otro usuario.`] } };
    }
    return { success: false, message: 'Error al actualizar usuario.', errors: { general: ['Error del servidor.'] } };
  }
}

export async function deleteUser(userId: string): Promise<AdminActionResponse<null>> {
  if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
  try {
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
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.name, u.email, u.role_id, r.name as role_name, u.status, DATE_FORMAT(u.lastLogin, "%Y-%m-%d %H:%i:%s") as lastLogin
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ORDER BY u.username ASC`
    );
    return rows.map(row => ({
        id: row.id.toString(),
        name: row.name,
        username: row.username,
        email: row.email,
        role_id: row.role_id,
        role_name: row.role_name,
        status: row.status,
        lastLogin: row.lastLogin,
        password: '', // Asegurar que la contraseña no se envía
    })) as (UserFormInput & { id: string; role_name?: string; lastLogin?: string })[];
  } catch (error) {
    console.error('Error al obtener usuarios (MySQL):', error);
    return [];
  }
}

export async function getRoles(): Promise<Role[]> {
  if (!pool) { console.error('DB pool no disponible en getRoles'); return []; }
  try {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT id, name, description FROM roles ORDER BY name ASC');
    return rows as Role[];
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
    const [rows] = await pool.query<RowDataPacket[]>('SELECT mfaEnabled, passwordPolicy, sessionTimeout FROM security_settings WHERE id = 1');
    if (rows.length > 0) {
      return { ...rows[0], mfaEnabled: Boolean(rows[0].mfaEnabled), sessionTimeout: Number(rows[0].sessionTimeout) } as SecuritySettingsFormInput;
    }
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
    const [rows] = await pool.query<RowDataPacket[]>('SELECT emailNotificationsEnabled, newSaleNotify, lowStockNotify FROM notification_settings WHERE id = 1');
    if (rows.length > 0) {
      return {
          ...rows[0],
          emailNotificationsEnabled: Boolean(rows[0].emailNotificationsEnabled),
          newSaleNotify: Boolean(rows[0].newSaleNotify),
          lowStockNotify: Boolean(rows[0].lowStockNotify),
      } as NotificationSettingsFormInput;
    }
    return { emailNotificationsEnabled: true, newSaleNotify: true, lowStockNotify: true };
  } catch (error) {
    console.error('Error al obtener config. notificaciones (MySQL):', error);
    return null;
  }
}

// --- Acciones para Gestión de Permisos ---
export async function getPermissions(): Promise<Permission[]> {
    if (!pool) {
        console.error('DB pool no disponible en getPermissions');
        return [];
    }
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id, action_name, module, description FROM permissions ORDER BY module, action_name'
        );
        return rows as Permission[];
    } catch (error) {
        console.error('Error al obtener permisos (MySQL):', error);
        return [];
    }
}

export async function getRolePermissions(roleId: number): Promise<number[]> {
    if (!pool) {
        console.error('DB pool no disponible en getRolePermissions');
        return [];
    }
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT permission_id FROM role_permissions WHERE role_id = ?',
            [roleId]
        );
        return rows.map(row => row.permission_id as number);
    } catch (error) {
        console.error(`Error al obtener permisos para el rol ${roleId} (MySQL):`, error);
        return [];
    }
}

export async function updateRolePermissions(
    data: RolePermissionFormInput
): Promise<AdminActionResponse<{roleId: number, permissionIds: number[]}>> {
    const validatedFields = RolePermissionSchema.safeParse(data);
    if (!validatedFields.success) {
        return { success: false, message: 'Error de validación.', errors: validatedFields.error.flatten().fieldErrors };
    }

    if (!pool) return { success: false, message: 'Error del servidor: DB no disponible.' };
    
    const { roleId, permissionIds } = validatedFields.data;
    let connection: Connection | null = null;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Eliminar todos los permisos existentes para este rol
        await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

        // Insertar los nuevos permisos
        if (permissionIds && permissionIds.length > 0) {
            const values = permissionIds.map(permissionId => [roleId, permissionId]);
            await connection.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ?', [values]);
        }

        await connection.commit();
        revalidatePath('/admin', 'layout'); // O una ruta más específica si es necesario
        return { success: true, message: 'Permisos del rol actualizados exitosamente.', data: { roleId, permissionIds } };

    } catch (error: any) {
        if (connection) await connection.rollback();
        console.error(`Error al actualizar permisos para el rol ${roleId} (MySQL):`, error);
        return { success: false, message: 'Error del servidor al actualizar permisos.', errors: { general: ['No se pudieron actualizar los permisos del rol.'] } };
    } finally {
        if (connection) connection.release();
    }
}

// (Opcional) Añadir CRUD para la tabla 'permissions' si se quiere gestionar desde la UI
// export async function addPermission(...) {}
// export async function updatePermission(...) {}
// export async function deletePermission(...) {}

// (Opcional) Añadir CRUD para la tabla 'roles' si se quiere gestionar desde la UI
// export async function addRole(...) {}
// export async function updateRole(...) {}
// export async function deleteRole(...) {}


    