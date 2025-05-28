
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '../globals.css'; // Ruta ajustada a globals.css desde /login
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Iniciar Sesión - Gestor Unificado de Negocios',
  description: 'Inicia sesión para acceder al Gestor Unificado de Negocios.',
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Las etiquetas <html> y <body> son manejadas por el RootLayout o por Next.js
  // Este layout específico para /login solo debe retornar su contenido directo.
  return (
    <>
      {/* 
        Las fuentes se aplican globalmente a través de RootLayout y globals.css.
        Si necesitas estilos MUY específicos solo para el body de la página de login 
        que no quieres en el resto de la app, podrías envolver {children} en un div 
        con esas clases, pero usualmente no es necesario si tu globals.css y RootLayout 
        manejan bien los estilos base.
        Para este caso, las clases de fuentes y 'antialiased bg-background text-foreground'
        se aplican desde el RootLayout.
      */}
      {children}
      <Toaster />
    </>
  );
}
