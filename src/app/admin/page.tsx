
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings as SettingsIcon, PlusCircle, Users, Building, Edit, Trash2, ShieldCheck, Bell, UserCog, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CompanyInfoSchema, SecuritySettingsSchema, NotificationSettingsSchema, UserSchema as AdminUserSchema, RolePermissionSchema
} from "@/app/schemas/admin.schemas";
import {
  type CompanyInfoFormInput,
  type UserFormInput,
  type SecuritySettingsFormInput,
  type NotificationSettingsFormInput,
  type RolePermissionFormInput,
  type Permission, type Role as AppRole,
  updateCompanyInfo, getCompanyInfo,
  addUser, updateUser, deleteUser, getUsers, getRoles as fetchRoles,
  updateSecuritySettings, getSecuritySettings,
  updateNotificationSettings, getNotificationSettings,
  getPermissions, getRolePermissions, updateRolePermissions
} from "@/app/actions/admin.actions";
import { useToast } from "@/hooks/use-toast";
import { getAccounts, type AccountWithDetails } from "@/app/actions/accounting.actions";


interface AppUser extends Omit<UserFormInput, 'role_id' | 'password'> {
  id: string;
  name: string;
  role_id?: number;
  role_name?: string;
  lastLogin?: string;
}


function CompanyInfoForm({ defaultValues, accounts, onFormSubmit }: { defaultValues: CompanyInfoFormInput, accounts: AccountWithDetails[], onFormSubmit: (data: CompanyInfoFormInput) => Promise<void> }) {
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
                        <SelectItem value="Europe/Madrid">Europa/Madrid (GMT+2)</SelectItem>
                        <SelectItem value="Europe/Paris">Europa/París (GMT+2)</SelectItem>
                        <SelectItem value="America/New_York">América/Nueva York (EST)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokio (JST)</SelectItem>
                    </SelectContent>
                </Select>
            )} />
            {errors.timezone && <p className="text-sm text-destructive mt-1">{errors.timezone.message}</p>}
        </div>
      </div>
       <Card className="border-border p-4">
        <CardTitle className="text-md mb-2">Cuentas Contables por Defecto</CardTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label htmlFor="defaultPurchasePayableAccountId">Cta. Por Pagar (Compras)</Label>
            <Controller name="defaultPurchasePayableAccountId" control={control} render={({ field }) => (<Select onValueChange={(val) => field.onChange(val ? Number(val) : null)} value={field.value?.toString() ?? ""}><SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger><SelectContent>{accounts.filter(a => a.type === 'Pasivo').map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select>)} />{errors.defaultPurchasePayableAccountId && <p className="text-sm text-destructive mt-1">{errors.defaultPurchasePayableAccountId.message}</p>}</div>
            <div><Label htmlFor="defaultAccountsReceivableId">Cta. Por Cobrar (Ventas)</Label>
            <Controller name="defaultAccountsReceivableId" control={control} render={({ field }) => (<Select onValueChange={(val) => field.onChange(val ? Number(val) : null)} value={field.value?.toString() ?? ""}><SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger><SelectContent>{accounts.filter(a => a.type === 'Activo').map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select>)} />{errors.defaultAccountsReceivableId && <p className="text-sm text-destructive mt-1">{errors.defaultAccountsReceivableId.message}</p>}</div>
            <div><Label htmlFor="defaultCashBankAccountId">Cta. Caja/Banco (Pagos)</Label>
            <Controller name="defaultCashBankAccountId" control={control} render={({ field }) => (<Select onValueChange={(val) => field.onChange(val ? Number(val) : null)} value={field.value?.toString() ?? ""}><SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger><SelectContent>{accounts.filter(a => a.type === 'Activo').map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select>)} />{errors.defaultCashBankAccountId && <p className="text-sm text-destructive mt-1">{errors.defaultCashBankAccountId.message}</p>}</div>
        </div>
      </Card>
      <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Configuración General"}</Button>
    </form>
  );
}

function UserForm({ user, roles, onFormSubmit, closeDialog }: { user?: AppUser, roles: AppRole[], onFormSubmit: (data: UserFormInput) => Promise<void>, closeDialog: () => void}) {
    const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<UserFormInput>({
        resolver: zodResolver(AdminUserSchema.omit(user && !(user as any).password ? { password: true} : {})), 
        defaultValues: user ? { ...user, password: '', role_id: user.role_id, name: user.name } : { name: '', username: '', email: '', role_id: undefined, status: 'Activo', password: ''},
    });
    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div><Label htmlFor="name">Nombre Completo</Label><Input id="name" {...register("name")} />{errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}</div>
            <div><Label htmlFor="username">Nombre de Usuario</Label><Input id="username" {...register("username")} />{errors.username && <p className="text-sm text-destructive mt-1">{errors.username.message}</p>}</div>
            <div><Label htmlFor="email">Correo Electrónico</Label><Input id="email" type="email" {...register("email")} />{errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}</div>
            <div><Label htmlFor="password">{user ? "Nueva Contraseña (opcional)" : "Contraseña"}</Label><Input id="password" type="password" {...register("password")} placeholder={user ? "Dejar en blanco para no cambiar" : ""}/>{errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}</div>
            <div>
                <Label htmlFor="role_id">Rol</Label>
                <Controller name="role_id" control={control} render={({ field }) => (
                    <Select onValueChange={(value) => field.onChange(value ? Number(value) : undefined)} value={field.value?.toString() ?? ""}>
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
          <Input id="sessionTimeout" type="number" {...register("sessionTimeout", { valueAsNumber: true })} />
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

function RolePermissionsForm({
    roles,
    allPermissions,
    onFormSubmit,
}: {
    roles: AppRole[];
    allPermissions: Permission[];
    onFormSubmit: (data: RolePermissionFormInput) => Promise<void>;
}) {
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [rolePermissions, setRolePermissions] = useState<number[]>([]);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
    const { toast } = useToast();

    const { handleSubmit, setValue, control, formState: { isSubmitting } } = useForm<RolePermissionFormInput>({
        resolver: zodResolver(RolePermissionSchema),
        defaultValues: { roleId: undefined, permissionIds: [] },
    });

    useEffect(() => {
        if (selectedRoleId) {
            setValue("roleId", selectedRoleId);
            setIsLoadingPermissions(true);
            getRolePermissions(selectedRoleId)
                .then(fetchedPermissions => {
                    setRolePermissions(fetchedPermissions);
                    setValue("permissionIds", fetchedPermissions);
                })
                .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los permisos del rol." }))
                .finally(() => setIsLoadingPermissions(false));
        } else {
            setRolePermissions([]);
            setValue("permissionIds", []);
        }
    }, [selectedRoleId, setValue, toast]);

    const handlePermissionChange = (permissionId: number, checked: boolean) => {
        const newPermissions = checked
            ? [...rolePermissions, permissionId]
            : rolePermissions.filter(id => id !== permissionId);
        setRolePermissions(newPermissions);
        setValue("permissionIds", newPermissions);
    };

    const permissionsByModule = useMemo(() => {
        return allPermissions.reduce((acc, permission) => {
            (acc[permission.module] = acc[permission.module] || []).push(permission);
            return acc;
        }, {} as Record<string, Permission[]>);
    }, [allPermissions]);

    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div>
                <Label htmlFor="selectedRole">Seleccionar Rol</Label>
                <Select onValueChange={(value) => setSelectedRoleId(Number(value))} value={selectedRoleId?.toString() ?? ""}>
                    <SelectTrigger id="selectedRole"><SelectValue placeholder="Seleccionar un rol..." /></SelectTrigger>
                    <SelectContent>
                        {roles.map(r => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {selectedRoleId && (
                isLoadingPermissions ? (
                    <div className="flex justify-center items-center h-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Cargando permisos...</p></div>
                ) : (
                <ScrollArea className="h-96 rounded-md border p-4">
                    <div className="space-y-4">
                        {Object.entries(permissionsByModule).map(([moduleName, permissionsInModule]) => (
                            <div key={moduleName}>
                                <h4 className="text-md font-semibold mb-2 capitalize border-b pb-1">{moduleName.replace(/_/g, " ")}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                                {permissionsInModule.map(permission => (
                                    <div key={permission.id} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`perm-${permission.id}`}
                                            checked={rolePermissions.includes(permission.id)}
                                            onCheckedChange={(checked) => handlePermissionChange(permission.id, Boolean(checked))}
                                        />
                                        <label htmlFor={`perm-${permission.id}`} className="text-sm font-normal cursor-pointer hover:text-primary" title={permission.description || permission.action_name}>
                                            {permission.action_name.replace(/_/g, " ")}
                                        </label>
                                    </div>
                                ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                )
            )}
            {selectedRoleId && !isLoadingPermissions && Object.keys(permissionsByModule).length === 0 && <p className="text-muted-foreground">No hay permisos definidos en el sistema.</p>}
            
            <Button type="submit" disabled={!selectedRoleId || isSubmitting || isLoadingPermissions}>
                {isSubmitting ? "Guardando..." : "Guardar Permisos del Rol"}
            </Button>
        </form>
    );
}


export default function AdminPage() {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfoFormInput | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [accountingAccounts, setAccountingAccounts] = useState<AccountWithDetails[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettingsFormInput | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsFormInput | null>(null);

  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | undefined>(undefined);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshAdminData = async () => {
      try {
        const [companyData, usersData, rolesData, securityData, notificationData, permissionsData, accountsData] = await Promise.all([
            getCompanyInfo(),
            getUsers(),
            fetchRoles(),
            getSecuritySettings(),
            getNotificationSettings(),
            getPermissions(),
            getAccounts()
        ]);
        if (companyData) setCompanyInfo(companyData);
        setUsers(usersData.map(u => ({...u, password: ''})) as AppUser[]);
        setRoles(rolesData);
        setAllPermissions(permissionsData);
        setAccountingAccounts(accountsData.filter(acc => ['Pasivo', 'Activo'].includes(acc.type)));
        if (securityData) setSecuritySettings(securityData);
        if (notificationData) setNotificationSettings(notificationData);
      } catch (error) {
          toast({ variant: "destructive", title: "Error de Carga", description: "No se pudieron cargar todos los datos de administración."})
          console.error("Error refreshing admin data:", error);
      }
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
    setDeletingUserId(null); 
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

  const handleRolePermissionsSubmit = async (data: RolePermissionFormInput) => {
    const response = await updateRolePermissions(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive", errors: response.errors });
    if(response.success) {
        // Opcional: refrescar solo los permisos del rol o toda la data de admin
        // refreshAdminData(); 
    }
  };


  if (!companyInfo || !securitySettings || !notificationSettings || roles.length === 0 && allPermissions.length === 0) { 
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Cargando configuración de administración...</p></div>;
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
                Gestiona la configuración general, usuarios, roles, permisos y más.
                </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6">
              <TabsTrigger value="general"><Building className="mr-2 h-4 w-4" />Configuración General</TabsTrigger>
              <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Gestión de Usuarios</TabsTrigger>
              <TabsTrigger value="roles"><KeyRound className="mr-2 h-4 w-4" />Roles y Permisos</TabsTrigger>
              <TabsTrigger value="security"><ShieldCheck className="mr-2 h-4 w-4" />Seguridad</TabsTrigger>
              <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />Notificaciones</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Información de la Empresa y Cuentas por Defecto</CardTitle><CardDescription>Configura los detalles de tu organización y las cuentas contables principales.</CardDescription></CardHeader>
                <CardContent><CompanyInfoForm defaultValues={companyInfo} accounts={accountingAccounts} onFormSubmit={handleCompanyInfoSubmit} /></CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Gestionar Usuarios</h3>
                <Button onClick={() => openUserDialog()}><PlusCircle className="mr-2 h-4 w-4"/> Añadir Nuevo Usuario</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nombre Completo</TableHead><TableHead>Nombre de Usuario</TableHead>
                    <TableHead>Correo Electrónico</TableHead><TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead><TableHead>Último Acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.username}</TableCell><TableCell>{user.email}</TableCell>
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
                     {users.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No hay usuarios registrados.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="roles">
                <Card>
                    <CardHeader><CardTitle>Gestión de Roles y Permisos</CardTitle><CardDescription>Define roles y asigna permisos específicos para cada uno.</CardDescription></CardHeader>
                    <CardContent>
                        {roles.length > 0 && allPermissions.length > 0 ? (
                             <RolePermissionsForm roles={roles} allPermissions={allPermissions} onFormSubmit={handleRolePermissionsSubmit} />
                        ) : (
                            <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center">
                                <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground">No hay roles o permisos definidos en el sistema. Contacta al administrador para configurarlos.</p>
                            </div>
                        )}
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
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editingUser ? "Editar Usuario" : "Añadir Nuevo Usuario"}</DialogTitle><DialogDescription>{editingUser ? "Actualiza los detalles del usuario." : "Completa los detalles del nuevo usuario."}</DialogDescription></DialogHeader>
            <UserForm user={editingUser} roles={roles} onFormSubmit={handleUserSubmit} closeDialog={() => { setIsUserDialogOpen(false); setEditingUser(undefined);}} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    