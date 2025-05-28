
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, PlusCircle, Edit, Trash2, FileText, DollarSign, TrendingUp, TrendingDown, BarChart3, Landmark, FilePenLine } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AccountSchema, JournalEntrySchema } from "@/app/schemas/accounting.schemas";
import {
  type AccountFormInput,
  type JournalEntryFormInput,
  addAccount, updateAccount, deleteAccount, getAccounts,
  addJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalEntries
} from "@/app/actions/accounting.actions";
import { useToast } from "@/hooks/use-toast";

const chartData = [
  { month: "Enero", revenue: 1860, expenses: 800 },
  { month: "Febrero", revenue: 3050, expenses: 1200 },
  { month: "Marzo", revenue: 2370, expenses: 950 },
  { month: "Abril", revenue: 730, expenses: 1100 },
  { month: "Mayo", revenue: 2090, expenses: 850 },
  { month: "Junio", revenue: 2140, expenses: 920 },
]

const chartConfig = {
  revenue: { label: "Ingresos", color: "hsl(var(--chart-1))" },
  expenses: { label: "Gastos", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

// --- Account Form Component ---
function AccountForm({ account, onFormSubmit, closeDialog }: { account?: AccountFormInput, onFormSubmit: (data: AccountFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<AccountFormInput>({
    resolver: zodResolver(AccountSchema),
    defaultValues: account || { code: '', name: '', type: undefined, balance: 0 },
  });
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="code">Código de Cuenta</Label>
        <Input id="code" {...register("code")} />
        {errors.code && <p className="text-sm text-destructive mt-1">{errors.code.message}</p>}
      </div>
      <div>
        <Label htmlFor="name">Nombre de Cuenta</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <Label htmlFor="type">Tipo de Cuenta</Label>
        <Controller name="type" control={control} render={({ field }) => (
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Activo">Activo</SelectItem>
              <SelectItem value="Pasivo">Pasivo</SelectItem>
              <SelectItem value="Patrimonio">Patrimonio</SelectItem>
              <SelectItem value="Ingreso">Ingreso</SelectItem>
              <SelectItem value="Gasto">Gasto</SelectItem>
            </SelectContent>
          </Select>
        )} />
        {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
      </div>
      <div>
        <Label htmlFor="balance">Saldo Inicial (€)</Label>
        <Input id="balance" type="number" step="0.01" {...register("balance")} disabled={!!account} />
        {errors.balance && <p className="text-sm text-destructive mt-1">{errors.balance.message}</p>}
         {!!account && <p className="text-xs text-muted-foreground mt-1">El saldo se actualiza mediante asientos contables.</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Cuenta"}</Button>
      </DialogFooter>
    </form>
  );
}

// --- Journal Entry Form Component ---
function JournalEntryForm({ entry, accounts, onFormSubmit, closeDialog }: { entry?: JournalEntryFormInput, accounts: AccountFormInput[], onFormSubmit: (data: JournalEntryFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<JournalEntryFormInput>({
    resolver: zodResolver(JournalEntrySchema),
    defaultValues: entry || { date: new Date().toISOString().split('T')[0], entryNumber: '', description: '', debitAccountCode: '', creditAccountCode: '', amount: 0 },
  });
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
        </div>
        <div>
          <Label htmlFor="entryNumber">N° Asiento</Label>
          <Input id="entryNumber" {...register("entryNumber")} />
          {errors.entryNumber && <p className="text-sm text-destructive mt-1">{errors.entryNumber.message}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" {...register("description")} />
        {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="debitAccountCode">Cuenta de Débito</Label>
          <Controller name="debitAccountCode" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
              <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.code}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.debitAccountCode && <p className="text-sm text-destructive mt-1">{errors.debitAccountCode.message}</p>}
        </div>
        <div>
          <Label htmlFor="creditAccountCode">Cuenta de Crédito</Label>
           <Controller name="creditAccountCode" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
              <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.code}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.creditAccountCode && <p className="text-sm text-destructive mt-1">{errors.creditAccountCode.message}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="amount">Monto (€)</Label>
        <Input id="amount" type="number" step="0.01" {...register("amount")} />
        {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Asiento"}</Button>
      </DialogFooter>
    </form>
  );
}


export default function AccountingPage() {
  const [chartOfAccounts, setChartOfAccounts] = useState<AccountFormInput[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntryFormInput[]>([]);
  const { toast } = useToast();

  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountFormInput | undefined>(undefined);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const [isJournalEntryDialogOpen, setIsJournalEntryDialogOpen] = useState(false);
  const [editingJournalEntry, setEditingJournalEntry] = useState<JournalEntryFormInput | undefined>(undefined);
  const [deletingJournalEntryId, setDeletingJournalEntryId] = useState<string | null>(null);

  const refreshAccountingData = async () => {
    const accountsData = await getAccounts();
    setChartOfAccounts(accountsData);
    const journalEntriesData = await getJournalEntries();
    setJournalEntries(journalEntriesData);
  };

  useEffect(() => {
    refreshAccountingData();
  }, []);

  const handleAccountSubmit = async (data: AccountFormInput) => {
    const response = editingAccount
      ? await updateAccount({ ...data, id: editingAccount.id })
      : await addAccount(data);
    if (response.success && response.data) {
      toast({ title: "Éxito", description: response.message });
      refreshAccountingData();
      setIsAccountDialogOpen(false);
      setEditingAccount(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message, errors: response.errors });
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (!deletingAccountId) return;
    const response = await deleteAccount(deletingAccountId);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if(response.success) {
      refreshAccountingData();
    }
    setDeletingAccountId(null); // Close dialog
  };

  const handleJournalEntrySubmit = async (data: JournalEntryFormInput) => {
    const response = editingJournalEntry
      ? await updateJournalEntry({ ...data, id: editingJournalEntry.id })
      : await addJournalEntry(data);
    if (response.success && response.data) {
      toast({ title: "Éxito", description: response.message });
      refreshAccountingData(); // Also refresh accounts as balances might change
      setIsJournalEntryDialogOpen(false);
      setEditingJournalEntry(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message, errors: response.errors });
    }
  };

  const handleDeleteJournalEntryConfirm = async () => {
    if (!deletingJournalEntryId) return;
    const response = await deleteJournalEntry(deletingJournalEntryId);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if(response.success) {
      refreshAccountingData(); // Also refresh accounts as balances might change
    }
    setDeletingJournalEntryId(null); // Close dialog
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Calculator className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold">Contabilidad</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Gestiona registros financieros, genera informes y realiza un seguimiento de la salud financiera general.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="dashboard">Panel Principal</TabsTrigger>
              <TabsTrigger value="chartOfAccounts">Plan de Cuentas</TabsTrigger>
              <TabsTrigger value="journalEntries">Asientos Contables</TabsTrigger>
              <TabsTrigger value="reports">Informes Financieros</TabsTrigger>
              <TabsTrigger value="reconciliation">Conciliación Bancaria</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ingresos Totales (Acumulado Anual)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">€125,670.50</div>
                    <p className="text-xs text-muted-foreground">+15.2% del año pasado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gastos Totales (Acumulado Anual)</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">€45,320.80</div>
                    <p className="text-xs text-muted-foreground">+8.1% del año pasado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Beneficio Neto (Acumulado Anual)</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">€80,349.70</div>
                    <p className="text-xs text-muted-foreground" style={{color: 'hsl(var(--accent))'}}>+20.5% del año pasado</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Resumen de Ingresos vs Gastos</CardTitle>
                  <CardDescription>Rendimiento de los últimos 6 meses</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `€${value/1000}k`} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chartOfAccounts" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Plan de Cuentas</h3>
                <Button onClick={() => { setEditingAccount(undefined); setIsAccountDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Añadir Cuenta</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre de Cuenta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartOfAccounts.map(acc => (
                      <TableRow key={acc.id}>
                        <TableCell>{acc.code}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell>{acc.type}</TableCell>
                        <TableCell className="text-right">€{acc.balance.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingAccount(acc); setIsAccountDialogOpen(true);}}><Edit className="mr-1 h-4 w-4"/>Editar</Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><Button onClick={() => setDeletingAccountId(acc.id!)} variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="mr-1 h-4 w-4"/>Eliminar</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Eliminar Cuenta?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible. Se eliminará la cuenta {chartOfAccounts.find(a => a.id === deletingAccountId)?.name}.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingAccountId(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAccountConfirm} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {chartOfAccounts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center">No hay cuentas en el plan.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="journalEntries" className="mt-6">
               <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Asientos Contables</h3>
                <Button onClick={() => { setEditingJournalEntry(undefined); setIsJournalEntryDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Nuevo Asiento</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>N° Asiento</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Cta. Débito</TableHead>
                      <TableHead>Cta. Crédito</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.entryNumber}</TableCell>
                        <TableCell className="font-medium">{entry.description}</TableCell>
                        <TableCell>{entry.debitAccountCode} - {chartOfAccounts.find(acc=>acc.code === entry.debitAccountCode)?.name}</TableCell>
                        <TableCell>{entry.creditAccountCode} - {chartOfAccounts.find(acc=>acc.code === entry.creditAccountCode)?.name}</TableCell>
                        <TableCell className="text-right">€{entry.amount.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingJournalEntry(entry); setIsJournalEntryDialogOpen(true);}}><Edit className="mr-1 h-4 w-4"/>Editar</Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild><Button onClick={() => setDeletingJournalEntryId(entry.id!)} variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="mr-1 h-4 w-4"/>Eliminar</Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Eliminar Asiento?</AlertDialogTitle><AlertDialogDescription>Esta acción es irreversible. Se eliminará el asiento {journalEntries.find(je => je.id === deletingJournalEntryId)?.entryNumber}.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingJournalEntryId(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteJournalEntryConfirm} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {journalEntries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No hay asientos contables.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-6 space-y-4">
               <h3 className="text-xl font-semibold">Informes Financieros</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" />
                  <div>
                    <p className="font-semibold">Balance General</p>
                    <p className="text-xs text-muted-foreground text-left">Ver activos, pasivos y patrimonio.</p>
                  </div>
                </Button>
                <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" />
                  <div>
                    <p className="font-semibold">Estado de Resultados</p>
                    <p className="text-xs text-muted-foreground text-left">Analizar ingresos y gastos.</p>
                  </div>
                </Button>
                {/* ... otros botones de informes ... */}
              </div>
            </TabsContent>

            <TabsContent value="reconciliation" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Conciliación Bancaria</h3>
                 <Button><Landmark className="mr-2 h-4 w-4"/> Iniciar Nueva Conciliación</Button>
              </div>
               <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20 p-8 text-center">
                 <p className="text-muted-foreground">Funcionalidad de conciliación próximamente.</p>
               </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Account Dialog */}
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar Cuenta" : "Añadir Nueva Cuenta"}</DialogTitle>
            <DialogDescription>{editingAccount ? "Actualiza los detalles de la cuenta." : "Completa los detalles para añadir una nueva cuenta."}</DialogDescription>
          </DialogHeader>
          <AccountForm account={editingAccount} onFormSubmit={handleAccountSubmit} closeDialog={() => setIsAccountDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Journal Entry Dialog */}
      <Dialog open={isJournalEntryDialogOpen} onOpenChange={setIsJournalEntryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJournalEntry ? "Editar Asiento Contable" : "Nuevo Asiento Contable"}</DialogTitle>
            <DialogDescription>{editingJournalEntry ? "Actualiza los detalles del asiento." : "Completa los detalles para un nuevo asiento."}</DialogDescription>
          </DialogHeader>
          <JournalEntryForm entry={editingJournalEntry} accounts={chartOfAccounts} onFormSubmit={handleJournalEntrySubmit} closeDialog={() => setIsJournalEntryDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

    