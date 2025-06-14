
import { z } from 'zod';

export const CompanyInfoSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es requerido.'),
  companyEmail: z.string().email('Correo electrónico inválido.'),
  companyAddress: z.string().min(1, 'La dirección es requerida.'),
  currency: z.enum(['EUR', 'USD', 'GBP']),
  timezone: z.string().min(1, 'La zona horaria es requerida.'),
});

export const UserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'El nombre completo es requerido.'),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email('Correo electrónico inválido.'),
  role_id: z.coerce.number({invalid_type_error: 'Debe seleccionar un rol.'}).positive({message: 'Debe seleccionar un rol.'}).optional(), // Asegúrate que el ID del rol sea positivo
  status: z.enum(["Activo", "Inactivo"]).default("Activo"),
  password: z.string().optional(), // Requerido para add, opcional para update
});

export const SecuritySettingsSchema = z.object({
  mfaEnabled: z.boolean().default(false),
  passwordPolicy: z.enum(['simple', 'medium', 'strong']),
  sessionTimeout: z.coerce.number().int().min(5, 'El tiempo de sesión debe ser al menos 5 minutos.'),
});

export const NotificationSettingsSchema = z.object({
  emailNotificationsEnabled: z.boolean().default(true),
  newSaleNotify: z.boolean().default(true),
  lowStockNotify: z.boolean().default(true),
});

