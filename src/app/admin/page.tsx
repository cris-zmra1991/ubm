
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings as SettingsIcon, PlusCircle, Users, Building, SlidersHorizontal, Edit, Trash2, ShieldCheck, KeyRound, Bell, UserCog } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  CompanyInfoSchema, type CompanyInfoFormInput, updateCompanyInfo, getCompanyInfo,
  UserSchema, type UserFormInput, addUser, updateUser, deleteUser, getUsers, getRoles as fetchRoles,
  SecuritySettingsSchema, type SecuritySettingsFormInput, updateSecuritySettings, getSecuritySettings,
  NotificationSettingsSchema, type NotificationSettingsFormInput, updateNotificationSettings, getNotificationSettings
} from "@/app/actions/admin.actions";
import { useToast } from "@/hooks/use-toast";


interface AppUser extends Omit<UserFormInput, 'role_id'> { 
  id: string;
  role_id?: number;
  role_name?: string;
  lastLogin?: string;
}

interface Role {
  id: number;
  name: string;
}


function CompanyInfoForm({ defaultValues, onFormSubmit }: { defaultValues: CompanyInfoFormInput, onFormSubmit: (data: CompanyInfoFormInput) => Promise<void> }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<CompanyInfoFormInput>({
    resolver: zodResolver(CompanyInfoSchema),
    defaultValues,
  });
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Nombre de la Empresa</Label>
          <Input id="companyName" {...register("companyName")} />
          {errors.companyName && <p className="text-sm text-destructive mt-1">{errors.companyName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companyEmail">Correo Electrónico de la Empresa</Label>
          <Input id="companyEmail" type="email" {...register("companyEmail")} />
          {errors.companyEmail && <p className="text-sm text-destructive mt-1">{errors.companyEmail.message}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
          <Label htmlFor="companyAddress">Dirección de la Empresa</Label>
          <Input id="companyAddress" {...register("companyAddress")} />
          {errors.companyAddress && <p className="text-sm text-destructive mt-1">{errors.companyAddress.message}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="space-y-1.5">
          <Label htmlFor="currency">Moneda Predeterminada</Label>
          <Controller name="currency" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="currency"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">Euro (€)</SelectItem>
                <SelectItem value="USD">Dólar Estadounidense ($)</SelectItem>
                <SelectItem value="GBP">Libra Esterlina (£)</SelectItem>
              </SelectContent>
            </Select>
          )} />
          {errors.currency && <p className="text-sm text-destructive mt-1">{errors.currency.message}</p>}
        </div>
        <div className="space-y-1.5">
            <Label htmlFor="timezone">Zona Horaria</Label>
            <Controller name="timezone" control={control} render={({ field }) => (
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger id="timezone"><SelectValue placeholder="Seleccionar zona horaria" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Europe/Paris">Europa/París (GMT+2)</SelectItem>
                        <SelectItem value="America/New_York">América/Nueva York (EST)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokio (JST)</SelectItem>
                    </SelectContent>
                </Select>
            )} />
            {errors.timezone && <p className="text-sm text-destructive mt-1">{errors.timezone.message}</p>}
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Configuración General"}</Button>
    </form>
  );
}

function UserForm({ user, roles, onFormSubmit, closeDialog }: { user?: AppUser, roles: Role[], onFormSubmit: (data: UserFormInput) => Promise<void>, closeDialog: () => void}) {
    const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<UserFormInput>({
        resolver: zodResolver(UserSchema.omit(user && !user.password ? { password: true} : {})), 
        defaultValues: user ? { ...user, password: '', role_id: user.role_id } : { username: '', email: '', role_id: undefined, status: 'Activo', password: ''},
    });
    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div><Label htmlFor="username">Nombre de Usuario</Label><Input id="username" {...register("username")} />{errors.username && <p className="text-sm text-destructive mt-1">{errors.username.message}</p>}</div>
            <div><Label htmlFor="email">Correo Electrónico</Label><Input id="email" type="email" {...register("email")} />{errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}</div>
            <div><Label htmlFor="password">{user ? "Nueva Contraseña (opcional)" : "Contraseña"}</Label><Input id="password" type="password" {...register("password")} placeholder={user ? "Dejar en blanco para no cambiar" : ""}/>{errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}</div>
            <div>
                <Label htmlFor="role_id">Rol</Label>
                <Controller name="role_id" control={control} render={({ field }) => (
                    <Select onValueChange={(value) => field.onChange(Number(value))} defaultValue={field.value?.toString()}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar rol..." /></SelectTrigger>
                        <SelectContent>
                            {roles.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )} />{errors.role_id && <p className="text-sm text-destructive mt-1">{errors.role_id.message}</p>}
            </div>
             <div>
                <Label htmlFor="status">Estado</Label>
                <Controller name="status" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                        <SelectItem value="Activo">Activo</SelectItem><SelectItem value="Inactivo">Inactivo</SelectItem>
                    </SelectContent></Select>
                )} />{errors.status && <p className="text-sm text-destructive mt-1">{errors.status.message}</p>}
            </div>
            <DialogFooter><Button variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Usuario"}</Button></DialogFooter>
        </form>
    );
}

function SecuritySettingsForm({ defaultValues, onFormSubmit }: { defaultValues: SecuritySettingsFormInput, onFormSubmit: (data: SecuritySettingsFormInput) => Promise<void> }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting }} = useForm<SecuritySettingsFormInput>({
    resolver: zodResolver(SecuritySettingsSchema),
    defaultValues,
  });
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div><Label htmlFor="mfaEnabled" className="font-semibold">Autenticación de Dos Factores (2FA)</Label><p className="text-sm text-muted-foreground">Requerir 2FA para todos los usuarios.</p></div>
        <Controller name="mfaEnabled" control={control} render={({ field }) => <Switch id="mfaEnabled" checked={field.value} onCheckedChange={field.onChange} />} />
      </div>
      {errors.mfaEnabled && <p className="text-sm text-destructive mt-1">{errors.mfaEnabled.message}</p>}
      
      <div className="space-y-1.5">
          <Label htmlFor="passwordPolicy">Política de Contraseñas</Label>
          <Controller name="passwordPolicy" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger id="passwordPolicy"><SelectValue placeholder="Seleccionar política..." /></SelectTrigger><SelectContent>
                <SelectItem value="simple">Simple (Mín. 8 caracteres)</SelectItem>
                <SelectItem value="medium">Media (Mín. 10 car., 1 número, 1 especial)</SelectItem>
                <SelectItem value="strong">Fuerte (Mín. 12 car., 1 mayús., 1 minús., 1 núm., 1 esp.)</SelectItem>
            </SelectContent></Select>
          )} />{errors.passwordPolicy && <p className="text-sm text-destructive mt-1">{errors.passwordPolicy.message}</p>}
      </div>
      <div className="space-y-1.5">
          <Label htmlFor="sessionTimeout">Tiempo de Sesión Agotado (minutos)</Label>
          <Input id="sessionTimeout" type="number" {...register("sessionTimeout")} />
          {errors.sessionTimeout && <p className="text-sm text-destructive mt-1">{errors.sessionTimeout.message}</p>}
      </div>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Configuración de Seguridad"}</Button>
    </form>
  );
}

function NotificationSettingsForm({ defaultValues, onFormSubmit }: { defaultValues: NotificationSettingsFormInput, onFormSubmit: (data: NotificationSettingsFormInput) => Promise<void> }) {
    const { handleSubmit, control, formState: { errors, isSubmitting } } = useForm<NotificationSettingsFormInput>({
        resolver: zodResolver(NotificationSettingsSchema),
        defaultValues,
    });
    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div><Label htmlFor="emailNotificationsEnabled" className="font-semibold">Notificaciones por Correo Electrónico</Label><p className="text-sm text-muted-foreground">Habilita o deshabilita las notificaciones globales.</p></div>
                <Controller name="emailNotificationsEnabled" control={control} render={({ field }) => <Switch id="emailNotificationsEnabled" checked={field.value} onCheckedChange={field.onChange} />} />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div><Label htmlFor="newSaleNotify" className="font-semibold">Notificación de Nueva Venta</Label><p className="text-sm text-muted-foreground">Notificar a los administradores sobre nuevas ventas.</p></div>
                <Controller name="newSaleNotify" control={control} render={({ field }) => <Switch id="newSaleNotify" checked={field.value} onCheckedChange={field.onChange} />} />
            </div>
             <div className="flex items-center justify-between p-4 border rounded-lg">
                <div><Label htmlFor="lowStockNotify" className="font-semibold">Alertas de Bajo Stock</Label><p className="text-sm text-muted-foreground">Enviar alertas para artículos con inventario bajo.</p></div>
                <Controller name="lowStockNotify" control={control} render={({ field }) => <Switch id="lowStockNotify" checked={field.value} onCheckedChange={field.onChange} />} />
            </div>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Configuración de Notificaciones"}</Button>
        </form>
    );
}


export default function AdminPage() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfoFormInput | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettingsFormInput | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsFormInput | null>(null);
  
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | undefined>(undefined);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshAdminData = async () => {
      const [companyData, usersData, rolesData, securityData, notificationData] = await Promise.all([
        getCompanyInfo(),
        getUsers(),
        fetchRoles(),
        getSecuritySettings(),
        getNotificationSettings()
      ]);
      if (companyData) setCompanyInfo(companyData);
      setUsers(usersData as AppUser[]); // Cast as AppUser which includes role_name
      setRoles(rolesData);
      if (securityData) setSecuritySettings(securityData);
      if (notificationData) setNotificationSettings(notificationData);
  };

  useEffect(() => {
    refreshAdminData();
  }, []);
  
  const handleCompanyInfoSubmit = async (data: CompanyInfoFormInput) => {
    const response = await updateCompanyInfo(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if (response.success && response.data) setCompanyInfo(response.data);
  };

  const handleUserSubmit = async (data: UserFormInput) => {
    const response = editingUser ? await updateUser({ ...data, id: editingUser.id }) : await addUser(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive", errors: response.errors });
    if (response.success) {
        refreshAdminData();
        setIsUserDialogOpen(false); setEditingUser(undefined);
    }
  };

  const handleDeleteUserConfirm = async () => {
    if(!deletingUserId) return;
    const response = await deleteUser(deletingUserId);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if (response.success) {
      refreshAdminData();
    }
    setDeletingUserId(null); // Close dialog
  };

  const openUserDialog = (user?: AppUser) => { setEditingUser(user); setIsUserDialogOpen(true); };
  
  const handleSecuritySettingsSubmit = async (data: SecuritySettingsFormInput) => {
    const response = await updateSecuritySettings(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if (response.success && response.data) setSecuritySettings(response.data);
  };

  const handleNotificationSettingsSubmit = async (data: NotificationSettingsFormInput) => {
    const response = await updateNotificationSettings(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
     if (response.success && response.data) setNotificationSettings(response.data);
  };


  if (!companyInfo || !securitySettings || !notificationSettings || roles.length === 0 && users.length > 0 /* Allow empty users if no roles yet */ ) {
    return <div className="flex justify-center items-center h-full"><p>Cargando configuración...</p></div>; 
  }

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
              <TabsTrigger value="roles"><UserCog className="mr-2 h-4 w-4" />Roles y Permisos</TabsTrigger>
              <TabsTrigger value="security"><ShieldCheck className="mr-2 h-4 w-4" />Seguridad</TabsTrigger>
              <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />Notificaciones</TabsTrigger>
              {/* <TabsTrigger value="integrations"><SlidersHorizontal className="mr-2 h-4 w-4" />Integraciones</TabsTrigger> */}
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Información de la Empresa</CardTitle><CardDescription>Configura los detalles de tu organización.</CardDescription></CardHeader>
                <CardContent><CompanyInfoForm defaultValues={companyInfo} onFormSubmit={handleCompanyInfoSubmit} /></CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Gestionar Usuarios</h3>
                <Button onClick={() => openUserDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Añadir Nuevo Usuario</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Nombre de Usuario</TableHead><TableHead>Correo Electrónico</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead><TableHead>Último Acceso</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role_name || "Sin rol"}</TableCell>
                        <TableCell><Badge variant={user.status === "Activo" ? "default" : "outline"} className={user.status === "Activo" ? "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30" : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"}>{user.status}</Badge></TableCell>
                        <TableCell>{user.lastLogin || "N/A"}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="sm" onClick={() => openUserDialog(user)}><Edit className="mr-1 h-4 w-4" /> Editar</Button>
                           <AlertDialog>
                            <AlertDialogTrigger asChild><Button onClick={()=>setDeletingUserId(user.id!)} variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="mr-1 h-4 w-4"/>Eliminar</Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar Usuario?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible. Se eliminará al usuario {users.find(u=>u.id === deletingUserId)?.username}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>setDeletingUserId(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteUserConfirm} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                           </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                     {users.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No hay usuarios registrados.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="roles">
                <Card>
                    <CardHeader><CardTitle>Gestión de Roles y Permisos</CardTitle><CardDescription>Define roles y asigna permisos específicos para cada uno. (Funcionalidad en desarrollo)</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center">
                            <UserCog className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">La gestión de roles y la asignación de permisos aparecerá aquí.</p>
                             <Button variant="secondary" className="mt-4" disabled>Gestionar Roles</Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="security" className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Configuración de Seguridad</CardTitle><CardDescription>Configura políticas de seguridad y controles de acceso.</CardDescription></CardHeader>
                    <CardContent><SecuritySettingsForm defaultValues={securitySettings} onFormSubmit={handleSecuritySettingsSubmit} /></CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
                 <Card>
                    <CardHeader><CardTitle>Configuración de Notificaciones</CardTitle><CardDescription>Gestiona cómo y cuándo se envían las notificaciones.</CardDescription></CardHeader>
                    <CardContent><NotificationSettingsForm defaultValues={notificationSettings} onFormSubmit={handleNotificationSettingsSubmit} /></CardContent>
                </Card>
            </TabsContent>

            {/* <TabsContent value="integrations">
                <Card>
                    <CardHeader><CardTitle>Integraciones y API</CardTitle><CardDescription>Conéctate con otros servicios y gestiona claves API.</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center">
                            <KeyRound className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">La gestión de claves API e integraciones de terceros aparecerá aquí.</p>
                             <Button variant="secondary" className="mt-4">Gestionar Claves API</Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent> */}
          </Tabs>
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editingUser ? "Editar Usuario" : "Añadir Nuevo Usuario"}</DialogTitle><DialogDescription>{editingUser ? "Actualiza los detalles del usuario." : "Completa los detalles del nuevo usuario."}</DialogDescription></DialogHeader>
            <UserForm user={editingUser} roles={roles} onFormSubmit={handleUserSubmit} closeDialog={() => { setIsUserDialogOpen(false); setEditingUser(undefined);}} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
