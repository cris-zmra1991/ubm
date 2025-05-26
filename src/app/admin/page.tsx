
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings as SettingsIcon, PlusCircle, Users, Building, SlidersHorizontal, MoreHorizontal, Edit, Trash2, ShieldCheck, KeyRound, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";


interface User {
  id: string;
  username: string;
  email: string;
  role: "Administrador" | "Gerente" | "Usuario";
  status: "Activo" | "Inactivo";
  lastLogin: string;
}

const usersData: User[] = [
  { id: "1", username: "johndoe", email: "john.doe@example.com", role: "Administrador", status: "Activo", lastLogin: "2024-07-22 10:00 AM" },
  { id: "2", username: "janesmith", email: "jane.smith@example.com", role: "Gerente", status: "Activo", lastLogin: "2024-07-21 03:00 PM" },
  { id: "3", username: "bobbuilder", email: "bob.builder@example.com", role: "Usuario", status: "Inactivo", lastLogin: "2024-06-15 09:00 AM" },
];


export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
                <CardTitle className="text-3xl font-bold">Configuración de Administración</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                Gestiona la configuración general de la aplicación, usuarios y configuraciones del sistema.
                </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6">
              <TabsTrigger value="general"><Building className="mr-2 h-4 w-4" />Configuración General</TabsTrigger>
              <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Gestión de Usuarios</TabsTrigger>
              <TabsTrigger value="security"><ShieldCheck className="mr-2 h-4 w-4" />Seguridad</TabsTrigger>
              <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />Notificaciones</TabsTrigger>
              <TabsTrigger value="integrations"><SlidersHorizontal className="mr-2 h-4 w-4" />Integraciones</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Información de la Empresa</CardTitle>
                  <CardDescription>Configura los detalles de tu organización.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName">Nombre de la Empresa</Label>
                      <Input id="companyName" defaultValue="Unified Business Solutions" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="companyEmail">Correo Electrónico de la Empresa</Label>
                      <Input id="companyEmail" type="email" defaultValue="contact@ubm.com" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                      <Label htmlFor="companyAddress">Dirección de la Empresa</Label>
                      <Input id="companyAddress" defaultValue="123 Main Street, Business City, BC 12345" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                      <Label htmlFor="currency">Moneda Predeterminada</Label>
                      <Select defaultValue="EUR">
                        <SelectTrigger id="currency">
                          <SelectValue placeholder="Seleccionar moneda" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">Euro (€)</SelectItem>
                          <SelectItem value="USD">Dólar Estadounidense ($)</SelectItem>
                          <SelectItem value="GBP">Libra Esterlina (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="timezone">Zona Horaria</Label>
                        <Select defaultValue="Europe/Paris">
                            <SelectTrigger id="timezone">
                            <SelectValue placeholder="Seleccionar zona horaria" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Europe/Paris">Europa/París (GMT+2)</SelectItem>
                                <SelectItem value="America/New_York">América/Nueva York (EST)</SelectItem>
                                <SelectItem value="Asia/Tokyo">Asia/Tokio (JST)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                    <Button>Guardar Configuración General</Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Gestionar Usuarios</h3>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Añadir Nuevo Usuario</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre de Usuario</TableHead>
                      <TableHead>Correo Electrónico</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Último Acceso</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === "Activo" ? "default" : "outline"}
                            className={user.status === "Activo" ? "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30" : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.lastLogin}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="sm"><Edit className="mr-2 h-4 w-4" /> Editar</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="security" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Seguridad</CardTitle>
                        <CardDescription>Configura políticas de seguridad y controles de acceso.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="mfa" className="font-semibold">Autenticación de Dos Factores (2FA)</Label>
                                <p className="text-sm text-muted-foreground">Requerir 2FA para todos los usuarios.</p>
                            </div>
                            <Switch id="mfa" />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="passwordPolicy">Política de Contraseñas</Label>
                            <Select defaultValue="medium">
                                <SelectTrigger id="passwordPolicy">
                                <SelectValue placeholder="Seleccionar política de contraseñas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="simple">Simple (Mín. 8 caracteres)</SelectItem>
                                    <SelectItem value="medium">Media (Mín. 10 car., 1 número, 1 especial)</SelectItem>
                                    <SelectItem value="strong">Fuerte (Mín. 12 car., 1 mayús., 1 minús., 1 núm., 1 esp.)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="sessionTimeout">Tiempo de Sesión Agotado (minutos)</Label>
                            <Input id="sessionTimeout" type="number" defaultValue="30" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button>Guardar Configuración de Seguridad</Button>
                    </CardFooter>
                </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Notificaciones</CardTitle>
                        <CardDescription>Gestiona cómo y cuándo se envían las notificaciones.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="emailNotifications" className="font-semibold">Notificaciones por Correo Electrónico</Label>
                                <p className="text-sm text-muted-foreground">Habilita o deshabilita las notificaciones por correo electrónico para todo el sistema.</p>
                            </div>
                            <Switch id="emailNotifications" defaultChecked />
                        </div>
                         <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="newSaleNotify" className="font-semibold">Notificación de Nueva Venta</Label>
                                <p className="text-sm text-muted-foreground">Notificar a los administradores sobre nuevas ventas.</p>
                            </div>
                            <Switch id="newSaleNotify" defaultChecked />
                        </div>
                         <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="lowStockNotify" className="font-semibold">Alertas de Bajo Stock</Label>
                                <p className="text-sm text-muted-foreground">Enviar alertas para artículos con inventario bajo.</p>
                            </div>
                            <Switch id="lowStockNotify" defaultChecked />
                        </div>
                    </CardContent>
                     <CardFooter>
                        <Button>Guardar Configuración de Notificaciones</Button>
                    </CardFooter>
                </Card>
            </TabsContent>

            <TabsContent value="integrations">
                <Card>
                    <CardHeader>
                        <CardTitle>Integraciones y API</CardTitle>
                        <CardDescription>Conéctate con otros servicios y gestiona claves API.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center">
                            <KeyRound className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">La gestión de claves API e integraciones de terceros aparecerá aquí.</p>
                            <p className="text-xs text-muted-foreground mt-1">Por ejemplo: pasarelas de pago, servicios de marketing por correo electrónico, etc.</p>
                             <Button variant="secondary" className="mt-4">Gestionar Claves API</Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
