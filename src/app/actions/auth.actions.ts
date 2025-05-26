
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { pool } from '@/lib/db';
import type { RowDataPacket } from 'mysql2';

// TODO: SQL - CREATE TABLE para usuarios
// CREATE TABLE users (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   username VARCHAR(255) NOT NULL UNIQUE,
//   password_hash VARCHAR(255) NOT NULL, -- Asegúrate de hashear las contraseñas
//   email VARCHAR(255) UNIQUE,
//   role VARCHAR(50) DEFAULT 'Usuario',
//   status VARCHAR(50) DEFAULT 'Activo',
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    return { message: 'Error del servidor: No se pudo conectar a la base de datos.', success: false };
  }

  try {
    console.log('Intentando autenticar para:', username);
    // TODO: Implementar hashing y verificación de contraseñas seguras (ej. bcrypt)
    // Por ahora, se compara texto plano (NO SEGURO PARA PRODUCCIÓN)
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM users WHERE username = ? AND password_hash = ?', // En una app real, password_hash sería el hash de 'password'
      [username, password] // Deberías comparar el hash de 'password' con el 'password_hash' almacenado
    );

    if (rows.length > 0) {
      const user = rows[0];
      console.log('Autenticación exitosa para el usuario:', user.username);
      // TODO: Lógica de creación de sesión/cookie aquí
      // Por ejemplo, usando next-auth o una librería similar, o implementando tu propia gestión de sesiones.
      // Por ahora, redirigimos directamente.
      redirect('/');
      // El redirect lanza una excepción, por lo que el return de abajo no se alcanza si hay éxito.
    } else {
      console.log('Autenticación fallida para:', username);
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
    };
  }
}
