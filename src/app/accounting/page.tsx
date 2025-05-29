
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, PlusCircle, Edit, Trash2, FileText, DollarSign, TrendingUp, TrendingDown, BarChart3, Landmark, FilePenLine, Loader2 } from "lucide-react";
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
  type AccountWithDetails,
  addAccount, updateAccount, deleteAccount, getAccounts,
  addJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalEntries,
  getAccountBalancesSummary,
  generateBalanceSheet, type BalanceSheetData,
  generateIncomeStatement, type IncomeStatementData,
  getIncomeVsExpenseChartData, type MonthlyIncomeExpense
} from "@/app/actions/accounting.actions";
import { useToast } from "@/hooks/use-toast";


const chartConfig = {
  revenue: { label: "Ingresos", color: "hsl(var(--chart-1))" },
  expenses: { label: "Gastos", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig

interface BalancesSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

function AccountForm({ account, existingAccounts, onFormSubmit, closeDialog }: { account?: AccountWithDetails, existingAccounts: AccountWithDetails[], onFormSubmit: (data: AccountFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<AccountFormInput>({
    resolver: zodResolver(AccountSchema),
    defaultValues: account || { code: '', name: '', type: undefined, balance: 0, parentAccountId: null },
  });
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div><Label htmlFor="code">Código</Label><Input id="code" {...register("code")} />{errors.code && <p className="text-sm text-destructive mt-1">{errors.code.message}</p>}</div>
      <div><Label htmlFor="name">Nombre</Label><Input id="name" {...register("name")} />{errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}</div>
      <div><Label htmlFor="type">Tipo</Label><Controller name="type" control={control} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger><SelectContent><SelectItem value="Activo">Activo</SelectItem><SelectItem value="Pasivo">Pasivo</SelectItem><SelectItem value="Patrimonio">Patrimonio</SelectItem><SelectItem value="Ingreso">Ingreso</SelectItem><SelectItem value="Gasto">Gasto</SelectItem></SelectContent></Select>)} />{errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}</div>
      <div><Label htmlFor="parentAccountId">Cta. Padre (Opcional)</Label><Controller name="parentAccountId" control={control} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value || ""}><SelectTrigger><SelectValue placeholder="Seleccionar cta. padre..." /></SelectTrigger><SelectContent><SelectItem value="">Ninguna</SelectItem>{existingAccounts.filter(acc => acc.id !== account?.id).map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select>)} />{errors.parentAccountId && <p className="text-sm text-destructive mt-1">{errors.parentAccountId.message}</p>}</div>
      <div><Label htmlFor="balance">Saldo Inicial (€)</Label><Input id="balance" type="number" step="0.01" {...register("balance", { valueAsNumber: true })} disabled={!!account} />{errors.balance && <p className="text-sm text-destructive mt-1">{errors.balance.message}</p>}{!!account && <p className="text-xs text-muted-foreground mt-1">El saldo de cuentas existentes se actualiza únicamente a través de asientos contables.</p>}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar"}</Button></DialogFooter>
    </form>
  );
}

function JournalEntryForm({ entry, accounts, onFormSubmit, closeDialog }: { entry?: JournalEntryFormInput & {id: string}, accounts: AccountWithDetails[], onFormSubmit: (data: JournalEntryFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<JournalEntryFormInput>({
    resolver: zodResolver(JournalEntrySchema),
    defaultValues: entry || { date: new Date().toISOString().split('T')[0], entryNumber: '', description: '', debitAccountCode: '', creditAccountCode: '', amount: 0 },
  });
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label htmlFor="date">Fecha</Label><Input id="date" type="date" {...register("date")} />{errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}</div>
        <div><Label htmlFor="entryNumber">N° Asiento (Automático si se deja vacío)</Label><Input id="entryNumber" {...register("entryNumber")} />{errors.entryNumber && <p className="text-sm text-destructive mt-1">{errors.entryNumber.message}</p>}</div>
      </div>
      <div><Label htmlFor="description">Descripción</Label><Input id="description" {...register("description")} />{errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}</div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label htmlFor="debitAccountCode">Cta. Débito</Label><Controller name="debitAccountCode" control={control} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Seleccionar cta..." /></SelectTrigger><SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.code}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select>)} />{errors.debitAccountCode && <p className="text-sm text-destructive mt-1">{errors.debitAccountCode.message}</p>}</div>
        <div><Label htmlFor="creditAccountCode">Cta. Crédito</Label><Controller name="creditAccountCode" control={control} render={({ field }) => (<Select onValueChange={field.onChange} defaultValue={field.value}><SelectTrigger><SelectValue placeholder="Seleccionar cta..." /></SelectTrigger><SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.code}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent></Select>)} />{errors.creditAccountCode && <p className="text-sm text-destructive mt-1">{errors.creditAccountCode.message}</p>}</div>
      </div>
      <div><Label htmlFor="amount">Monto (€)</Label><Input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />{errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar"}</Button></DialogFooter>
    </form>
  );
}


export default function AccountingPage() {
  const [chartOfAccounts, setChartOfAccounts] = useState<AccountWithDetails[]>([]);
  const [journalEntries, setJournalEntries] = useState<(JournalEntryFormInput & { id: string })[]>([]);
  const [balancesSummary, setBalancesSummary] = useState<BalancesSummary>({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 });
  const [incomeExpenseChartData, setIncomeExpenseChartData] = useState<MonthlyIncomeExpense[]>([]);
  const { toast } = useToast();

  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithDetails | undefined>(undefined);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const [isJournalEntryDialogOpen, setIsJournalEntryDialogOpen] = useState(false);
  const [editingJournalEntry, setEditingJournalEntry] = useState<(JournalEntryFormInput & { id: string }) | undefined>(undefined);
  const [deletingJournalEntryId, setDeletingJournalEntryId] = useState<string | null>(null);

  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null);
  const [isBalanceSheetLoading, setIsBalanceSheetLoading] = useState(false);
  const [incomeStatementData, setIncomeStatementData] = useState<IncomeStatementData | null>(null);
  const [isIncomeStatementLoading, setIsIncomeStatementLoading] = useState(false);


  const refreshAccountingData = async () => {
    try {
        const [accountsData, journalEntriesData, summaryData, chartData] = await Promise.all([
            getAccounts(),
            getJournalEntries(),
            getAccountBalancesSummary(),
            getIncomeVsExpenseChartData(6) // Últimos 6 meses
        ]);
        setChartOfAccounts(accountsData);
        setJournalEntries(journalEntriesData);
        setBalancesSummary(summaryData);
        setIncomeExpenseChartData(chartData);
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos contables." });
        console.error("Error refreshing accounting data:", error);
    }
  };

  useEffect(() => {
    refreshAccountingData();
  }, []);

  const handleAccountSubmit = async (data: AccountFormInput) => {
    const response = editingAccount ? await updateAccount({ ...data, id: editingAccount.id }) : await addAccount(data);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      refreshAccountingData(); setIsAccountDialogOpen(false); setEditingAccount(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message, errors: response.errors });
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (!deletingAccountId) return;
    const response = await deleteAccount(deletingAccountId);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if(response.success) refreshAccountingData();
    setDeletingAccountId(null);
  };

  const handleJournalEntrySubmit = async (data: JournalEntryFormInput) => {
    // No permitir crear/editar asientos desde aquí, solo visualizar.
    // La creación es automática, edición/reversión requiere lógica más compleja.
    toast({variant: "default", title: "Información", description: "La creación/edición de asientos manuales se gestiona de forma interna o requiere herramientas avanzadas."});
    // const response = editingJournalEntry ? await updateJournalEntry({ ...data, id: editingJournalEntry.id! }) : await addJournalEntry(data);
    // if (response.success) {
    //   toast({ title: "Éxito", description: response.message });
    //   refreshAccountingData(); setIsJournalEntryDialogOpen(false); setEditingJournalEntry(undefined);
    // } else {
    //   toast({ variant: "destructive", title: "Error", description: response.message, errors: response.errors });
    // }
    setIsJournalEntryDialogOpen(false); 
    setEditingJournalEntry(undefined);
  };

  const handleDeleteJournalEntryConfirm = async () => {
    if (!deletingJournalEntryId) return;
    // La eliminación directa de asientos no se recomienda. Se debe hacer un asiento de reversión.
    toast({variant: "destructive", title: "Acción no permitida", description: "La eliminación directa de asientos no está permitida. Considere un asiento de reversión."});
    // const response = await deleteJournalEntry(deletingJournalEntryId);
    // toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    // if(response.success) refreshAccountingData();
    setDeletingJournalEntryId(null);
  };

  const handleGenerateBalanceSheet = async () => {
    setIsBalanceSheetLoading(true);
    setBalanceSheetData(null);
    try {
      const data = await generateBalanceSheet();
      setBalanceSheetData(data);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el Balance General." });
      console.error("Error generating balance sheet:", error);
    } finally {
      setIsBalanceSheetLoading(false);
    }
  };

  const handleGenerateIncomeStatement = async () => {
    setIsIncomeStatementLoading(true);
    setIncomeStatementData(null);
    try {
      const data = await generateIncomeStatement();
      setIncomeStatementData(data);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el Estado de Resultados." });
      console.error("Error generating income statement:", error);
    } finally {
      setIsIncomeStatementLoading(false);
    }
  };


  const renderAccountsRows = (accountsToRender: AccountWithDetails[], level = 0): JSX.Element[] => {
    let rows: JSX.Element[] = [];
    for (const acc of accountsToRender) {
      rows.push(
        <TableRow key={acc.id} className={level > 0 ? "bg-muted/30 hover:bg-muted/50" : "hover:bg-muted/30"}>
          <TableCell style={{ paddingLeft: `${level * 20 + 16}px` }}>{level > 0 ? '↳ ' : ''}{acc.code}</TableCell>
          <TableCell className="font-medium">{acc.name}</TableCell>
          <TableCell>{acc.type}</TableCell>
          <TableCell className="text-right">€{acc.balance.toFixed(2)}</TableCell>
          <TableCell className="text-right font-semibold">€{(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell>
          <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => { setEditingAccount(acc); setIsAccountDialogOpen(true);}}><Edit className="mr-1 h-4 w-4"/>Editar</Button>
              <AlertDialog><AlertDialogTrigger asChild><Button onClick={() => setDeletingAccountId(acc.id!)} variant="ghost" size="sm" className="text-destructive hover:text-destructive"><Trash2 className="mr-1 h-4 w-4"/>Eliminar</Button></AlertDialogTrigger>
                  <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar Cuenta?</AlertDialogTitle><AlertDialogDescription>Se eliminará {chartOfAccounts.find(a => a.id === deletingAccountId)?.name}. Si tiene cuentas hijas o asientos, no se podrá eliminar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingAccountId(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteAccountConfirm} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
          </TableCell>
        </TableRow>
      );
      if (acc.children && acc.children.length > 0) {
        const sortedChildren = [...acc.children].sort((a,b) => a.code.localeCompare(b.code));
        rows = rows.concat(renderAccountsRows(sortedChildren, level + 1));
      }
    }
    return rows;
  };

  const rootAccounts = chartOfAccounts.filter(acc => !acc.parentAccountId || !chartOfAccounts.find(a => a.id === acc.parentAccountId)).sort((a, b) => a.code.localeCompare(b.code));


  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader><div className="flex items-center gap-3"><Calculator className="h-8 w-8 text-primary" /><div><CardTitle className="text-3xl font-bold">Contabilidad</CardTitle><CardDescription className="text-lg text-muted-foreground">Gestión financiera y salud del negocio.</CardDescription></div></div></CardHeader>
        <CardContent>
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="dashboard">Panel Principal</TabsTrigger>
              <TabsTrigger value="chartOfAccounts">Plan de Cuentas</TabsTrigger>
              <TabsTrigger value="journalEntries">Asientos Contables</TabsTrigger>
              <TabsTrigger value="reports">Informes</TabsTrigger>
              <TabsTrigger value="reconciliation">Conciliación</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">€{balancesSummary.totalRevenue.toFixed(2)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Gastos Totales</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">€{balancesSummary.totalExpenses.toFixed(2)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Beneficio Neto</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">€{balancesSummary.netProfit.toFixed(2)}</div><p className={`text-xs ${balancesSummary.netProfit >= 0 ? 'text-green-600 dark:text-green-300' : 'text-destructive'}`}>{balancesSummary.netProfit >=0 ? 'Positivo' : 'Negativo'}</p></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle>Resumen de Ingresos vs Gastos</CardTitle><CardDescription>Rendimiento de los últimos meses.</CardDescription></CardHeader>
                <CardContent className="h-[300px] w-full">
                  {incomeExpenseChartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%"><BarChart data={incomeExpenseChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} /><YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `€${value/1000}k`} /><ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} /><Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} /></BarChart></ResponsiveContainer>
                    </ChartContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">Cargando datos del gráfico...</div>
                  )}
                  </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chartOfAccounts" className="mt-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold">Plan de Cuentas</h3><Button onClick={() => { setEditingAccount(undefined); setIsAccountDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Añadir Cuenta</Button></div>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">S. Directo</TableHead><TableHead className="text-right">S. Acumulado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{chartOfAccounts.length > 0 ? renderAccountsRows(rootAccounts) : <TableRow><TableCell colSpan={6} className="text-center">No hay cuentas contables definidas.</TableCell></TableRow>}</TableBody></Table></div>
            </TabsContent>

            <TabsContent value="journalEntries" className="mt-6">
               <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold">Libro Diario (Asientos Contables)</h3>
               {/* <Button onClick={() => { setEditingJournalEntry(undefined); setIsJournalEntryDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Nuevo Asiento Manual</Button> */}
               </div>
               <p className="text-sm text-muted-foreground mb-4">Los asientos se generan automáticamente desde Compras y Ventas. La edición/reversión manual requiere herramientas avanzadas.</p>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>N° Asiento</TableHead><TableHead>Descripción</TableHead><TableHead>Cta. Débito</TableHead><TableHead>Cta. Crédito</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{journalEntries.map(entry => (<TableRow key={entry.id}><TableCell>{entry.date}</TableCell><TableCell>{entry.entryNumber}</TableCell><TableCell className="font-medium max-w-xs truncate">{entry.description}</TableCell><TableCell>{entry.debitAccountCode} - {chartOfAccounts.find(acc=>acc.code === entry.debitAccountCode)?.name}</TableCell><TableCell>{entry.creditAccountCode} - {chartOfAccounts.find(acc=>acc.code === entry.creditAccountCode)?.name}</TableCell><TableCell className="text-right">€{Number(entry.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingJournalEntry(entry); setIsJournalEntryDialogOpen(true);}} disabled><Edit className="mr-1 h-4 w-4"/>Editar</Button>
                    <AlertDialog><AlertDialogTrigger asChild><Button onClick={() => setDeletingJournalEntryId(entry.id!)} variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled><Trash2 className="mr-1 h-4 w-4"/>Eliminar</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar Asiento Contable?</AlertDialogTitle><AlertDialogDescription>Se eliminará el asiento {journalEntries.find(je => je.id === deletingJournalEntryId)?.entryNumber}. ¡Advertencia! Esta acción no revierte automáticamente el impacto en los saldos de las cuentas. Considere crear un asiento de reversión en su lugar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingJournalEntryId(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteJournalEntryConfirm} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                  </TableCell></TableRow>))}
                  {journalEntries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No hay asientos contables registrados.</TableCell></TableRow>}
                </TableBody></Table>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
                <Card>
                    <CardHeader><CardTitle>Informes Financieros</CardTitle><CardDescription>Genera balances, estados de resultados y otros informes.</CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex gap-4 mb-6">
                            <Button onClick={handleGenerateBalanceSheet} disabled={isBalanceSheetLoading}>
                                {isBalanceSheetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generar Balance General
                            </Button>
                            <Button onClick={handleGenerateIncomeStatement} disabled={isIncomeStatementLoading}>
                                {isIncomeStatementLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generar Estado de Resultados
                            </Button>
                        </div>

                        {isBalanceSheetLoading && <div className="text-center p-4"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p>Generando Balance General...</p></div>}
                        {balanceSheetData && (
                            <Card>
                                <CardHeader><CardTitle>Balance General</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <h4 className="font-semibold mb-2">Activos</h4>
                                            <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {balanceSheetData.assets.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}
                                                    <TableRow className="font-bold"><TableCell>Total Activos</TableCell><TableCell className="text-right">{balanceSheetData.totalAssets.toFixed(2)}</TableCell></TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2">Pasivos</h4>
                                            <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {balanceSheetData.liabilities.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{Math.abs(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}
                                                    <TableRow className="font-bold"><TableCell>Total Pasivos</TableCell><TableCell className="text-right">{balanceSheetData.totalLiabilities.toFixed(2)}</TableCell></TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold mb-2">Patrimonio</h4>
                                            <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {balanceSheetData.equity.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{Math.abs(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}
                                                    <TableRow className="font-bold"><TableCell>Total Patrimonio</TableCell><TableCell className="text-right">{balanceSheetData.totalEquity.toFixed(2)}</TableCell></TableRow>
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                    <div className="mt-4 font-bold text-lg">Total Pasivos + Patrimonio: €{balanceSheetData.totalLiabilitiesAndEquity.toFixed(2)}</div>
                                    {Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) > 0.01 && (
                                        <p className="text-destructive mt-2">¡Descuadre! Total Activos no es igual a Total Pasivos + Patrimonio.</p>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {isIncomeStatementLoading && <div className="text-center p-4"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p>Generando Estado de Resultados...</p></div>}
                        {incomeStatementData && (
                            <Card className="mt-6">
                                <CardHeader><CardTitle>Estado de Resultados</CardTitle></CardHeader>
                                <CardContent>
                                    <h4 className="font-semibold mb-2">Ingresos</h4>
                                    <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {incomeStatementData.revenues.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{Math.abs(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}
                                            <TableRow className="font-bold"><TableCell>Total Ingresos</TableCell><TableCell className="text-right">{incomeStatementData.totalRevenues.toFixed(2)}</TableCell></TableRow>
                                        </TableBody>
                                    </Table>
                                    <h4 className="font-semibold mt-4 mb-2">Gastos</h4>
                                    <Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {incomeStatementData.expenses.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}
                                            <TableRow className="font-bold"><TableCell>Total Gastos</TableCell><TableCell className="text-right">{incomeStatementData.totalExpenses.toFixed(2)}</TableCell></TableRow>
                                        </TableBody>
                                    </Table>
                                    <div className={`mt-4 font-bold text-lg ${incomeStatementData.netIncome >= 0 ? 'text-green-600 dark:text-green-300' : 'text-destructive'}`}>
                                        Beneficio Neto (Pérdida): €{incomeStatementData.netIncome.toFixed(2)}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                         {!isBalanceSheetLoading && !balanceSheetData && !isIncomeStatementLoading && !incomeStatementData && (
                            <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center">
                                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                                <p className="text-muted-foreground">Selecciona un informe para generar.</p>
                            </div>
                         )}
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="reconciliation" className="mt-6">
                 <Card>
                    <CardHeader><CardTitle>Conciliación Bancaria</CardTitle><CardDescription>Compara tus registros contables con los extractos bancarios. (Funcionalidad en desarrollo)</CardDescription></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center">
                            <Landmark className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">Las herramientas de conciliación bancaria aparecerán aquí.</p>
                             <Button variant="secondary" className="mt-4" disabled>Iniciar Conciliación</Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isAccountDialogOpen} onOpenChange={(isOpen) => { setIsAccountDialogOpen(isOpen); if (!isOpen) setEditingAccount(undefined); }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editingAccount ? "Editar Cuenta Contable" : "Nueva Cuenta Contable"}</DialogTitle><DialogDescription>{editingAccount ? "Actualiza los detalles de la cuenta." : "Completa los detalles para una nueva cuenta."}</DialogDescription></DialogHeader><AccountForm account={editingAccount} existingAccounts={chartOfAccounts} onFormSubmit={handleAccountSubmit} closeDialog={() => { setIsAccountDialogOpen(false); setEditingAccount(undefined);}} /></DialogContent>
      </Dialog>
      <Dialog open={isJournalEntryDialogOpen} onOpenChange={(isOpen) => { setIsJournalEntryDialogOpen(isOpen); if (!isOpen) setEditingJournalEntry(undefined); }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editingJournalEntry ? "Ver Asiento" : "Nuevo Asiento Manual"}</DialogTitle><DialogDescription>{editingJournalEntry ? "Detalles del asiento contable." : "La creación manual no está permitida para asegurar integridad."}</DialogDescription></DialogHeader>
        {/* El formulario de asientos se deshabilita para creación/edición directa desde UI */}
        {editingJournalEntry && (
            <div className="space-y-4 mt-4">
                <p><strong>Fecha:</strong> {editingJournalEntry.date}</p>
                <p><strong>N° Asiento:</strong> {editingJournalEntry.entryNumber}</p>
                <p><strong>Descripción:</strong> {editingJournalEntry.description}</p>
                <p><strong>Cta. Débito:</strong> {editingJournalEntry.debitAccountCode} - {chartOfAccounts.find(acc => acc.code === editingJournalEntry.debitAccountCode)?.name}</p>
                <p><strong>Cta. Crédito:</strong> {editingJournalEntry.creditAccountCode} - {chartOfAccounts.find(acc => acc.code === editingJournalEntry.creditAccountCode)?.name}</p>
                <p><strong>Monto:</strong> €{Number(editingJournalEntry.amount).toFixed(2)}</p>
                 <DialogFooter><Button type="button" variant="outline" onClick={() => { setIsJournalEntryDialogOpen(false); setEditingJournalEntry(undefined); }}>Cerrar</Button></DialogFooter>
            </div>
        )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
