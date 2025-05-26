
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { handleLogin, type LoginFormState } from "@/app/actions/auth.actions";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
// El useRouter ya no es necesario aquí si la redirección se maneja completamente en el Server Action
// import { useRouter } from "next/navigation";

const initialState: LoginFormState = {
  message: null,
  success: false,
};

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full !mt-8" type="submit" disabled={pending}>
      {pending ? (
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <LogIn className="mr-2 h-5 w-5" />
      )}
      {pending ? "Iniciando Sesión..." : "Iniciar Sesión"}
    </Button>
  );
}


export default function LoginPage() {
  const [state, formAction] = useFormState(handleLogin, initialState);
  const { toast } = useToast();
  // const router = useRouter(); // No es necesario si el redirect está en el Server Action

  useEffect(() => {
    if (state.message && !state.success) {
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: state.message || (state.errors?.general && state.errors.general.join(', ')),
      });
    }
    // La redirección en caso de éxito ahora la maneja el Server Action con `redirect('/')`.
    // No se necesita lógica de redirección del lado del cliente aquí si el Server Action lo hace.
  }, [state, toast]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-2xl border-border rounded-xl overflow-hidden">
        <CardHeader className="space-y-2 text-center p-6 sm:p-8 bg-card">
           <div className="flex justify-center mb-4">
             {/* Logo SVG simple - puedes reemplazarlo con tu componente Logo si lo prefieres */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20" width="150" height="30" className="text-primary">
              <defs>
                <linearGradient id="loginLogoGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: 'hsl(var(--accent))', stopOpacity: 1 }} />
                </linearGradient>
              </defs>
              <rect width="8" height="16" x="2" y="2" rx="2" fill="url(#loginLogoGradient)" />
              <rect width="8" height="16" x="12" y="2" rx="2" fill="hsl(var(--primary))" opacity="0.7" />
              <text
                x="25"
                y="15"
                fontFamily="var(--font-geist-sans), Arial, sans-serif"
                fontSize="12"
                fontWeight="bold"
                fill="hsl(var(--foreground))"
              >
                UBM
              </text>
            </svg>
          </div>
          <CardTitle className="text-3xl font-bold text-foreground">Bienvenido de Nuevo</CardTitle>
          <CardDescription className="text-muted-foreground px-2">
            Ingresa tus credenciales para acceder a tu Gestor Unificado de Negocios.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 sm:px-8 pb-6 space-y-6 bg-card">
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground font-medium">Nombre de usuario</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="ej., admin"
                required
                className="bg-input/30 border-border focus:border-primary focus:ring-primary/50 text-base"
                aria-describedby="username-error"
              />
              {state.errors?.username && (
                <p id="username-error" className="text-sm text-destructive pt-1">{state.errors.username.join(', ')}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground font-medium">Contraseña</Label>
                <Link
                  href="#" // TODO: Implementar flujo de recuperación de contraseña
                  className="text-sm font-medium text-primary hover:underline"
                  tabIndex={-1}
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="bg-input/30 border-border focus:border-primary focus:ring-primary/50 text-base"
                aria-describedby="password-error"
              />
              {state.errors?.password && (
                <p id="password-error" className="text-sm text-destructive pt-1">{state.errors.password.join(', ')}</p>
              )}
            </div>
            {state.errors?.general && (
              <p className="text-sm text-destructive text-center py-2 bg-destructive/10 rounded-md">{state.errors.general.join(', ')}</p>
            )}
            <LoginButton />
          </form>
        </CardContent>
        <CardFooter className="px-6 sm:px-8 py-6 text-center bg-muted/30 border-t border-border">
          <p className="text-sm text-muted-foreground">
            ¿No tienes una cuenta?{" "}
            <Link href="#" className="font-semibold text-primary hover:underline"> {/* TODO: Implementar página de registro */}
              Regístrate
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
