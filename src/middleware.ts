
// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getSession, type SessionPayload } from './lib/session';

const PUBLIC_PATHS = ['/login']; // Rutas que no requieren autenticación

// Definición de patrones de acceso por rol
const ROLE_ACCESS_PATTERNS: Record<string, RegExp[]> = {
  'Default': [/^\/$/], // Rol por defecto si no hay uno específico (solo dashboard)
  'Administrador': [/^\/.*$/], // Acceso total
  'Contador': [/^\/$/, /^\/accounting(\/.*)?$/, /^\/expenses(\/.*)?$/],
  'Gerente': [/^\/$/, /^\/sales(\/.*)?$/, /^\/purchases(\/.*)?$/, /^\/inventory(\/.*)?$/, /^\/contacts(\/.*)?$/],
  'Almacenero': [/^\/$/, /^\/inventory(\/.*)?$/],
  'Comercial': [/^\/$/, /^\/contacts(\/.*)?$/, /^\/sales(\/.*)?$/],
};


export async function middleware(request: NextRequest) {
  const session: SessionPayload | null = await getSession();
  const currentPath = request.nextUrl.pathname;

  const isPublicPath = PUBLIC_PATHS.includes(currentPath);

  if (isPublicPath) {
    if (session && currentPath === '/login') {
      // Si el usuario tiene sesión y está en /login, redirigir al dashboard
      return NextResponse.redirect(new URL('/', request.url));
    }
    // Permitir acceso a rutas públicas si no hay sesión o si no es /login con sesión
    return NextResponse.next();
  }

  // Si la ruta no es pública y no hay sesión, redirigir a /login
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectedFrom', currentPath); // Opcional: para redirigir después del login
    return NextResponse.redirect(loginUrl);
  }

  // Si hay sesión y la ruta no es pública, aplicar RBAC
  const userRole = session.roleName || 'Default'; // Usar rol de la sesión
  const allowedPatterns = ROLE_ACCESS_PATTERNS[userRole] || ROLE_ACCESS_PATTERNS['Default'];
  const isAllowed = allowedPatterns.some(pattern => pattern.test(currentPath));

  if (!isAllowed) {
    // Si el rol no permite acceso a la ruta actual, redirigir al dashboard
    // Podrías tener una página específica '/unauthorized' en el futuro
    console.warn(`RBAC: Usuario ${session.username} (Rol: ${userRole}) DENEGADO acceso a ${currentPath}. Redirigiendo a /`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Si todo está bien, permitir el acceso y refrescar la cookie de sesión
  const response = NextResponse.next();
  // Refrescar la sesión
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
    /*
     * Coincide con todas las rutas de solicitud excepto aquellas que comienzan con:
     * - api (rutas API)
     * - _next/static (archivos estáticos)
     * - _next/image (archivos de optimización de imágenes)
     * - favicon.ico (archivo favicon)
     * Se protegen todas las demás rutas, incluyendo explícitamente la raíz '/'
     * y cualquier otra ruta de página. El login se maneja dentro de la lógica.
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
