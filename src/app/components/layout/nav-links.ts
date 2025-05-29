
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Store,
  CreditCard,
  Calculator,
  Boxes,
  Settings,
  Banknote, // Icono para Pagos
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navLinks: NavLink[] = [
  { href: '/', label: 'Panel Principal', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contactos', icon: Users },
  { href: '/purchases', label: 'Compras', icon: ShoppingCart },
  { href: '/sales', label: 'Ventas', icon: Store },
  { href: '/expenses', label: 'Gastos', icon: CreditCard },
  { href: '/payments', label: 'Pagos', icon: Banknote },
  { href: '/accounting', label: 'Contabilidad', icon: Calculator },
  { href: '/inventory', label: 'Inventario', icon: Boxes },
  { href: '/admin', label: 'Administración', icon: Settings },
];
