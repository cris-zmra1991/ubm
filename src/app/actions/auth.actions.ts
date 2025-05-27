
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db'; // This alias seems to work, so we'll keep it for now. If it also fails, it might need similar treatment.
import type { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { createSession, deleteSession } from '../../lib/session'; // Changed to relative path

const LoginSchema = z.object({
  username: z.string().min(1, { message: 'El nombre de usuario es requerido.' }),
  password: z.string().min(1, { message: 'La contraseña es requerida.' }),
});

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
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, password_hash, status, role_id FROM users WHERE username = ?',
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
    // const passwordMatches = await bcrypt.compare(password, user.password_hash);
    // Por ahora, comparamos en texto plano (NO SEGURO PARA PRODUCCIÓN)
    const passwordMatches = await bcrypt.compare(password, user.password_hash);


    if (passwordMatches) {
      console.log(`Autenticación exitosa para el usuario: ${user.username}`);

      try {
        await pool.query('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      } catch (updateError) {
        console.error('Error al actualizar lastLogin:', updateError);
        // No bloqueamos el login por esto, pero es bueno registrarlo
      }
      
      const sessionPayload = {
        userId: user.id.toString(),
        username: user.username,
        roleId: user.role_id, // Asegúrate que esto venga de la DB
        // Puedes añadir más datos a la sesión si es necesario (ej. permisos resumidos)
      };
      await createSession(sessionPayload); // Crear la sesión y establecer la cookie

      // Redirigir al dashboard después de un login exitoso
      // Next.js recomienda usar redirect() fuera del bloque try/catch
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
  // La redirección debe estar fuera del try/catch
  redirect('/');
}

export async function handleLogout() {
  await deleteSession(); // Eliminar la cookie de sesión
  redirect('/login');
}
