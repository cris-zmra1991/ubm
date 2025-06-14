
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { createSession, deleteSession } from '@/lib/session';
import { LoginSchema } from '@/app/schemas/auth.schemas';

export interface LoginFormState {
  message: string | null;
  errors?: {
    username?: string[];
    password?: string[];
    general?: string[];
  };
  success: boolean;
}

export async function handleLogin(
  prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const validatedFields = LoginSchema.safeParse({
    username: formData.get('username'),
    password: formData.get('password'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Campos inválidos.',
      errors: validatedFields.error.flatten().fieldErrors,
      success: false,
    };
  }

  const { username, password } = validatedFields.data;

  if (!pool) {
    console.error('Error: Pool de conexiones no disponible en handleLogin.');
    return {
        message: 'Error del servidor: No se pudo conectar a la base de datos.',
        success: false,
        errors: { general: ['Error de conexión con la base de datos. Por favor, inténtelo más tarde.'] }
    };
  }

  try {
    console.log(`Intentando autenticar para el usuario: ${username}`);
    // SQL - Obtener usuario, incluyendo nombre y nombre del rol
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.name, u.password_hash, u.status, u.role_id, r.name as roleName
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.username = ?`,
      [username]
    );

    if (rows.length === 0) {
      console.log(`Usuario no encontrado: ${username}`);
      return {
        message: 'Credenciales inválidas.',
        errors: { general: ['Nombre de usuario o contraseña incorrectos.'] },
        success: false,
      };
    }

    const user = rows[0];

    if (user.status !== 'Activo') {
      console.log(`Cuenta inactiva para el usuario: ${username}`);
      return {
        message: 'Esta cuenta de usuario está inactiva.',
        errors: { general: ['Esta cuenta de usuario está inactiva. Contacte al administrador.'] },
        success: false,
      };
    }

    // TODO: Implementar password hashing (e.g., bcrypt)
    // Por ahora, asumimos que la contraseña en la BD NO está hasheada (lo cual es inseguro)
    // En una implementación real:
    // const passwordMatches = bcrypt.compareSync(password, user.password_hash);
    const passwordMatches = user.password_hash ? bcrypt.compareSync(password, user.password_hash) : false;


    if (passwordMatches) {
      console.log(`Autenticación exitosa para el usuario: ${user.username}`);

      // Actualizar lastLogin
      try {
        await pool.query('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      } catch (updateError) {
        // No crítico, solo loguear
        console.error('Error al actualizar lastLogin:', updateError);
      }

      const sessionPayload = {
        userId: user.id.toString(),
        username: user.username,
        name: user.name,
        roleId: user.role_id,
        roleName: user.roleName || 'Usuario', // Fallback por si el rol no tiene nombre o no hay rol
      };
      await createSession(sessionPayload);

    } else {
      console.log(`Contraseña incorrecta para: ${username}`);
      return {
        message: 'Credenciales inválidas.',
        errors: { general: ['Nombre de usuario o contraseña incorrectos.'] },
        success: false,
      };
    }
  } catch (error) {
    console.error('Error durante el proceso de login (MySQL):', error);
    return {
      message: 'Error del servidor durante el inicio de sesión.',
      success: false,
      errors: { general: ['Ocurrió un error inesperado. Por favor, inténtelo más tarde.'] }
    };
  }
  redirect('/'); // Redirigir al dashboard después de un login exitoso
}

export async function handleLogout() {
  await deleteSession();
  redirect('/login');
}
