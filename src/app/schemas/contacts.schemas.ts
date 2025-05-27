
import { z } from 'zod';

export const ContactSchema = z.object({
  id: z.string().optional(), 
  name: z.string().min(1, 'El nombre es requerido.'),
  email: z.string().email('Correo electrónico inválido.'),
  phone: z.string().min(1, 'El teléfono es requerido.'),
  type: z.enum(['Cliente', 'Proveedor', 'Prospecto'], {
    errorMap: () => ({ message: 'Selecciona un tipo de contacto válido.' }),
  }),
  company: z.string().optional(),
});
