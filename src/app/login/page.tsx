
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { handleLogin, type LoginFormState } from "@/app/actions/auth.actions";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const initialState: LoginFormState = {
  message: null,
  success: false,
};

export default function LoginPage() {
  const [state, formAction] = useFormState(handleLogin, initialState);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state.message && !state.success) {
      toast({
        variant: "destructive",
        title: "Error de inicio de sesión",
        description: state.message || (state.errors?.general && state.errors.general.join(', ')),
      });
    }
    // Next.js Server Action redirects are exceptions. If handleLogin calls redirect(),
    // this component might unmount before this effect runs for the success case.
    // The redirect in handleLogin will take precedence if it's thrown.
    // If a success state without redirect was returned, then client-side redirect could happen here.
    // if (state.success && state.message === 'Autenticación exitosa') {
    //   router.push('/');
    // }
  }, [state, toast, router]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-2xl border-border rounded-xl">
        <CardHeader className="space-y-2 text-center p-8">
          <div className="flex justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20" width="150" height="30" className="text-primary">
              <rect width="8" height="16" x="2" y="2" rx="2" fill="currentColor" />
              <rect width="8" height="16" x="12" y="2" rx="2" fill="currentColor" opacity="0.7" />
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
          <CardDescription className="text-muted-foreground">
            Ingresa tus credenciales para acceder a tu Gestor Unificado de Negocios.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-6 space-y-6">
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">Nombre de usuario</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="ej., admin"
                required
                className="bg-input/50 border-border focus:border-primary"
              />
              {state.errors?.username && (
                <p className="text-sm text-destructive">{state.errors.username.join(', ')}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground">Contraseña</Label>
                <Link
                  href="#"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="ej., password"
                required
                className="bg-input/50 border-border focus:border-primary"
              />
              {state.errors?.password && (
                <p className="text-sm text-destructive">{state.errors.password.join(', ')}</p>
              )}
            </div>
            {state.errors?.general && (
              <p className="text-sm text-destructive">{state.errors.general.join(', ')}</p>
            )}
            <Button className="w-full !mt-8" type="submit">
              <LogIn className="mr-2 h-5 w-5" /> Iniciar Sesión
            </Button>
          </form>
        </CardContent>
        <CardFooter className="px-8 pb-8 text-center">
          <p className="text-sm text-muted-foreground">
            ¿No tienes una cuenta?{" "}
            <Link href="#" className="font-semibold text-primary hover:underline">
              Regístrate
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
