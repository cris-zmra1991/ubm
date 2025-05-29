
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState, useMemo } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { navLinks as allNavLinks, type NavLink } from './nav-links';
import { Logo } from '@/components/icons/logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, LogOut, UserCircle, Settings as SettingsIcon } from 'lucide-react';
import { handleLogout } from '@/app/actions/auth.actions';
import type { SessionPayload } from '@/lib/session';

interface AppShellProps {
  children: ReactNode;
  session: SessionPayload | null;
}

const ROLE_ACCESS_PATTERNS: Record<string, RegExp[]> = {
  'Default': [/^\/$/],
  'Administrador': [/^\/.*$/],
  'Contador': [/^\/$/, /^\/accounting(\/.*)?$/, /^\/expenses(\/.*)?$/, /^\/payments(\/.*)?$/],
  'Gerente': [/^\/$/, /^\/sales(\/.*)?$/, /^\/purchases(\/.*)?$/, /^\/inventory(\/.*)?$/, /^\/contacts(\/.*)?$/, /^\/payments(\/.*)?$/], // Gerente también podría ver pagos
  'Almacenero': [/^\/$/, /^\/inventory(\/.*)?$/],
  'Comercial': [/^\/$/, /^\/contacts(\/.*)?$/, /^\/sales(\/.*)?$/],
};

export function AppShell({ children, session }: AppShellProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  const showAppShellUI = !isLoginPage && session;

  return (
    <SidebarProvider defaultOpen>
      {showAppShellUI && <Sidebar_Internal navLinks={allNavLinks} pathname={pathname} session={session} />}
      <div className="flex flex-col flex-1 overflow-hidden">
        {showAppShellUI && <AppHeader session={session} />}
        <main className={`flex-1 overflow-y-auto bg-background ${isLoginPage ? 'h-screen' : ''}`}>
          {isLoginPage ? (
            children
          ) : (
            <SidebarInset>
              <div className="p-4 sm:p-6 lg:p-8">
               {children}
              </div>
            </SidebarInset>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}

function Sidebar_Internal({ navLinks: allNavLinks, pathname, session }: { navLinks: NavLink[]; pathname: string | null; session: SessionPayload | null }) {
  const { open, state } = useSidebar();
  const userRole = session?.roleName || 'Default';

  const filteredNavLinks = useMemo(() => {
    if (!session) return [];

    const allowedPatterns = ROLE_ACCESS_PATTERNS[userRole] || ROLE_ACCESS_PATTERNS['Default'];

    return allNavLinks.filter(link => {
      if (link.href === '/') return true;
      return allowedPatterns.some(pattern => pattern.test(link.href));
    });
  }, [userRole, session]); // Removed allNavLinks from dependency array as it's constant


  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar" className="border-r border-sidebar-border shadow-md">
      <SidebarHeader className="p-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="w-auto h-8" />
          { (open || state === "expanded") && <span className="font-semibold text-lg text-sidebar-foreground">Gestor Unificado</span>}
        </Link>
      </SidebarHeader>
      <ScrollArea className="flex-1">
        <SidebarContent>
          <SidebarMenu>
            {filteredNavLinks.map((link) => (
              <SidebarMenuItem key={link.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === link.href}
                  tooltip={{ children: link.label, side: 'right', className: 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border' }}
                >
                  <Link href={link.href}>
                    <link.icon className="shrink-0" />
                    <span>{link.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </ScrollArea>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {session && <UserMenu session={session} />}
      </SidebarFooter>
    </Sidebar>
  );
}

function AppHeader({ session }: { session: SessionPayload | null }) {
  const { isMobile } = useSidebar();
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-4 md:px-6 shadow-sm">
      {isMobile && <SidebarTrigger />}
      <div className="flex-1">
        {/* Placeholder for breadcrumbs or page title if needed */}
      </div>
      <div className="ml-auto">
        {session && <UserMenu session={session} />}
      </div>
    </header>
  );
}


function UserMenu({ session }: { session: SessionPayload | null }) {
  const { open, state, isMobile } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!session) {
    return null;
  }

  const userName = session.name;
  const userInitials = session.name ? session.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'U';
  const showInSidebar = !isMobile && (open || state === "expanded");


  if (showInSidebar) { // UserMenu en la Sidebar (cuando está expandida)
     return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground h-10 px-2">
            <Avatar className="h-7 w-7 mr-2">
              <AvatarImage src={`https://placehold.co/40x40.png?text=${userInitials}`} alt={userName || "Usuario"} data-ai-hint="user avatar"/>
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex items-center w-full text-sm">
              <span className="truncate">{userName} ({session.roleName})</span>
              {mounted && <ChevronDown className="ml-auto h-4 w-4 shrink-0" />}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-popover text-popover-foreground border-border" align="end" sideOffset={5}>
          <DropdownMenuLabel className="text-xs">Mi Cuenta</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserCircle className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <SettingsIcon className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={handleLogout} className="w-full">
             <DropdownMenuItem asChild>
                <Button type="submit" variant="ghost" className="w-full justify-start text-sm h-auto font-normal text-destructive hover:text-destructive focus-visible:ring-destructive cursor-pointer px-2 py-1.5">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </Button>
             </DropdownMenuItem>
           </form>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // UserMenu en la AppHeader (o sidebar colapsada)
  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="rounded-full h-9 w-9 p-0"> {/* Más pequeño */}
            <Avatar className="h-8 w-8"> {/* Avatar más pequeño */}
              <AvatarImage src={`https://placehold.co/40x40.png?text=${userInitials}`} alt={userName || "Usuario"} data-ai-hint="user avatar"/>
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <span className="sr-only">Menú de Usuario</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-popover text-popover-foreground border-border" align="end" sideOffset={5}>
          <DropdownMenuLabel className="text-xs">{userName} ({session.roleName})</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <UserCircle className="mr-2 h-4 w-4" />
            <span>Perfil</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <SettingsIcon className="mr-2 h-4 w-4" />
            <span>Configuración</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
           <form action={handleLogout} className="w-full">
             <DropdownMenuItem asChild>
                <Button type="submit" variant="ghost" className="w-full justify-start text-sm h-auto font-normal text-destructive hover:text-destructive focus-visible:ring-destructive cursor-pointer px-2 py-1.5">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Cerrar Sesión</span>
                </Button>
             </DropdownMenuItem>
           </form>
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
