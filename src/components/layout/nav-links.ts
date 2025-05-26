import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Store,
  CreditCard,
  Calculator,
  Boxes,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navLinks: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { href: '/sales', label: 'Sales', icon: Store },
  { href: '/expenses', label: 'Expenses', icon: CreditCard },
  { href: '/accounting', label: 'Accounting', icon: Calculator },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/admin', label: 'Admin', icon: Settings },
];
