
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';
// TODO: Import a password hashing library like bcrypt
// import bcrypt from 'bcryptjs';

// TODO: SQL - CREATE TABLE para usuarios (si no existe o difiere de la de admin.actions.ts)
// CREATE TABLE users (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   username VARCHAR(255) NOT NULL UNIQUE,
//   password_hash VARCHAR(255) NOT NULL, -- Asegúrate de hashear las contraseñas
//   email VARCHAR(255) UNIQUE,
//   role_id INT, -- FK to roles table
//   status VARCHAR(50) DEFAULT 'Activo',
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
//   FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL
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
    console.error('Error: Connection pool not available in handleLogin.');
    return { message: 'Error del servidor: No se pudo conectar a la base de datos.', success: false, errors: { general: ['Error de conexión con la base de datos.'] } };
  }

  try {
    console.log('Intentando autenticar para:', username);
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, password_hash FROM users WHERE username = ? AND status = "Activo"',
      [username]
    );

    if (rows.length > 0) {
      const user = rows[0];
      // TODO: Implementar hashing y verificación de contraseñas seguras (ej. bcrypt)
      // const passwordMatches = await bcrypt.compare(password, user.password_hash);
      const passwordMatches = password === user.password_hash; // REEMPLAZAR ESTO con bcrypt.compare

      if (passwordMatches) {
        console.log('Autenticación exitosa para el usuario:', user.username);
        // TODO: Lógica de creación de sesión/cookie aquí
        // Por ejemplo, usando next-auth o una librería similar.
        // Por ahora, redirigimos directamente.
        redirect('/'); 
        // El redirect lanza una excepción, por lo que el return de abajo no se alcanza si hay éxito.
        // No es necesario retornar explícitamente desde aquí después de un redirect.
      } else {
        console.log('Contraseña incorrecta para:', username);
        return {
          message: 'Credenciales inválidas.',
          errors: { general: ['Nombre de usuario o contraseña incorrectos.'] },
          success: false,
        };
      }
    } else {
      console.log('Usuario no encontrado o inactivo:', username);
      return {
        message: 'Credenciales inválidas.',
        errors: { general: ['Nombre de usuario o contraseña incorrectos.'] },
        success: false,
      };
    }
  } catch (error) {
    console.error('Error durante el login:', error);
    return {
      message: 'Error del servidor durante el inicio de sesión.',
      success: false,
      errors: { general: ['Ocurrió un error inesperado.'] }
    };
  }
}
