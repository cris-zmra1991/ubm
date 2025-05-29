
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, type SessionPayload } from './lib/session';

const PUBLIC_PATHS = ['/login'];

// Definición de patrones de acceso por rol.
// Asegúrate de que los nombres de los roles coincidan EXACTAMENTE con los de tu BD.
const ROLE_ACCESS_PATTERNS: Record<string, RegExp[]> = {
  'Default': [/^\/$/], // Solo acceso al dashboard
  'Administrador': [/^\/.*$/], // Acceso total
  'Contador': [
    /^\/$/, // Dashboard
    /^\/accounting(\/.*)?$/,
    /^\/expenses(\/.*)?$/,
    /^\/payments(\/.*)?$/, // Acceso a Pagos
  ],
  'Gerente': [
    /^\/$/, // Dashboard
    /^\/sales(\/.*)?$/,
    /^\/purchases(\/.*)?$/,
    /^\/inventory(\/.*)?$/,
    /^\/contacts(\/.*)?$/,
    /^\/payments(\/.*)?$/, // Gerente también puede ver pagos
  ],
  'Almacenero': [
    /^\/$/, // Dashboard
    /^\/inventory(\/.*)?$/,
  ],
  'Comercial': [
    /^\/$/, // Dashboard
    /^\/contacts(\/.*)?$/,
    /^\/sales(\/.*)?$/,
  ],
};


export async function middleware(request: NextRequest) {
  const session: SessionPayload | null = await getSession();
  const currentPath = request.nextUrl.pathname;

  const isPublicPath = PUBLIC_PATHS.includes(currentPath);

  if (isPublicPath) {
    if (session && currentPath === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', currentPath);
    return NextResponse.redirect(loginUrl);
  }

  // Si hay sesión, verificar acceso por rol
  const userRole = session.roleName || 'Default'; // Usar 'Default' si roleName es null o undefined
  const allowedPatterns = ROLE_ACCESS_PATTERNS[userRole] || ROLE_ACCESS_PATTERNS['Default'];
  const isAllowed = allowedPatterns.some(pattern => pattern.test(currentPath));

  if (!isAllowed) {
    console.warn(`RBAC: Usuario ${session.username} (Rol: ${userRole}) DENEGADO acceso a ${currentPath}. Redirigiendo a /`);
    return NextResponse.redirect(new URL('/', request.url)); // Redirigir al dashboard si no tiene permiso
  }

  // Refrescar la cookie de sesión en cada solicitud a una ruta protegida
  const response = NextResponse.next();
  const expires = new Date(Date.now() + (parseInt(process.env.SESSION_MAX_AGE_SECONDS || '3600', 10) * 1000));
  const sessionToken = request.cookies.get('session_token_ubm')?.value;

  if (sessionToken) {
    response.cookies.set('session_token_ubm', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        expires: expires,
        sameSite: 'lax',
        path: '/',
    });
  }
  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
