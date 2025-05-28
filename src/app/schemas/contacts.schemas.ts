
import { z } from 'zod';

export const ContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre es requerido.'),
  // El email ya no es UNIQUE a nivel de Zod aquí, la BD se encargará de la no-unicidad.
  // La validación de formato email sigue siendo importante.
  email: z.string().email('Correo electrónico inválido.'),
  phone: z.string().min(1, 'El teléfono es requerido.'),
  type: z.enum(['Cliente', 'Proveedor', 'Prospecto'], {
    errorMap: () => ({ message: 'Selecciona un tipo de contacto válido.' }),
  }),
  company: z.string().optional(),
});
