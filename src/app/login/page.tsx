
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  // TODO: Implement form submission logic
  // const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
  //   event.preventDefault();
  //   // Handle login logic here
  //   console.log("Login submitted");
  // };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md shadow-2xl border-border rounded-xl">
        <CardHeader className="space-y-2 text-center p-8">
          <div className="flex justify-center mb-4">
            {/* You can replace this with a proper logo if available */}
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
          <form className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">Nombre de usuario</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="ej., juanperez" 
                required 
                className="bg-input/50 border-border focus:border-primary"
              />
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
                type="password" 
                placeholder="••••••••" 
                required 
                className="bg-input/50 border-border focus:border-primary"
              />
            </div>
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
