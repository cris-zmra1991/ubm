
'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';

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

  // TODO: Reemplazar con lógica de autenticación real contra base de datos MySQL
  console.log('Simulando autenticación para:', username);
  if (username === 'admin' && password === 'password') {
    // Simulación de creación de sesión/cookie aquí
    console.log('Autenticación simulada exitosa.');
    // No se puede llamar a redirect() directamente dentro de un try/catch que espera un Server Action.
    // Se debe lanzar el redirect fuera o manejar el estado de forma diferente si se está dentro.
    // Para `useFormState`, el redirect debe ocurrir después de retornar el estado.
    // O, si no se usa useFormState, se puede hacer un redirect directo.
    // En este caso, para que funcione con useFormState, el redirect se manejará en el cliente basado en `success: true`.
    // O, si se quiere un redirect directo del servidor, la acción no debería ser usada con useFormState
    // o el redirect debe ser lanzado de una manera que Next.js pueda manejar (e.g., no después de retornar un estado que cause re-render).
    // Para este ejemplo, vamos a asumir que el redirect se maneja en el cliente tras una respuesta exitosa.
    // O mejor aún, lanzar el redirect directamente si la acción no espera retornar un estado para el formulario.
    // Si es un form action tradicional (sin JS o con JS progresivo), el redirect funciona.
  } else {
    console.log('Autenticación simulada fallida.');
    return {
      message: 'Credenciales inválidas.',
      errors: { general: ['Nombre de usuario o contraseña incorrectos.'] },
      success: false,
    };
  }
  // Si la autenticación es exitosa y no hay errores, se redirige.
  // Este redirect DEBE estar fuera de cualquier try/catch si el try/catch está esperando retornar un Server Action.
  // Para Server Actions usados con useFormState, el redirect es una excepción que Next.js maneja.
  redirect('/');

  // Esta parte no se alcanzará si el redirect ocurre.
  // Se mantiene para estructura si se decidiera no redirigir inmediatamente desde el server action.
  // return { message: 'Autenticación exitosa', success: true };
}
