
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';

// SQL para la tabla 'users' (ya debería estar creada según scripts anteriores)
// CREATE TABLE users (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   username VARCHAR(255) NOT NULL UNIQUE,
//   email VARCHAR(255) NOT NULL UNIQUE,
//   password_hash VARCHAR(255) NOT NULL,
//   role_id INT,
//   status ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
//   lastLogin TIMESTAMP NULL,
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL ON UPDATE CASCADE
// );

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

    const passwordMatches = bcrypt.compareSync(password, user.password_hash);

    if (passwordMatches) {
      console.log(`Autenticación exitosa para el usuario: ${user.username}`);
      
      // TODO: Implementar lógica de creación de sesión/cookie aquí.
      // Por ejemplo, usando next-auth o una librería similar.
      // Por ahora, solo actualizamos lastLogin y redirigimos.

      try {
        await pool.query('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      } catch (updateError) {
        console.error('Error al actualizar lastLogin:', updateError);
        // Continuar con el login aunque falle la actualización de lastLogin
      }
      
      // Redirigir al dashboard
      redirect('/'); 
      // El redirect lanza una excepción, por lo que este return no se alcanzará si hay éxito.
      // return { message: 'Autenticación exitosa', success: true };
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
}
