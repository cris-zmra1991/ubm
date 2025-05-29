
"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, PlusCircle, Edit, Trash2, FileText, DollarSign, TrendingUp, TrendingDown, BarChart3, Landmark, FilePenLine, Loader2, CalendarDays, Settings2, BookLock, Library, AlertTriangle } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AccountSchema, JournalEntrySchema, FiscalYearSchema, CompanyAccountingSettingsSchema, type FiscalYearFormInput } from "@/app/schemas/accounting.schemas";
import {
  type AccountFormInput,
  type JournalEntryFormInput,
  type AccountWithDetails,
  type FiscalYear,
  type CompanyAccountingSettingsFormInput,
  addAccount, updateAccount, deleteAccount, getAccounts,
  addJournalEntry, updateJournalEntry, deleteJournalEntry, getJournalEntries,
  getAccountBalancesSummary,
  generateBalanceSheet, type BalanceSheetData,
  generateIncomeStatement, type IncomeStatementData,
  getIncomeVsExpenseChartData, type MonthlyIncomeExpense,
  getFiscalYears, addFiscalYear, updateFiscalYear, deleteFiscalYear,
  getCompanyAccountingSettings, updateCompanyAccountingSettings, closeFiscalYearProcess
} from "@/app/actions/accounting.actions";
import { useToast } from "@/hooks/use-toast";
import type { SessionPayload } from '@/lib/session'; // Para obtener userID para el cierre
import { Badge } from "@/components/ui/badge";


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
      <div><Label htmlFor="balance">Saldo Inicial (€)</Label><Input id="balance" type="number" step="0.01" {...register("balance", { valueAsNumber: true })} disabled={!!account} />{errors.balance && <p className="text-sm text-destructive mt-1">{errors.balance.message}</p>}{!!account && <p className="text-xs text-muted-foreground mt-1">El saldo de cuentas existentes se actualiza únicamente a través de asientos contables o procesos de cierre.</p>}</div>
      <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar"}</Button></DialogFooter>
    </form>
  );
}

function FiscalYearForm({ fiscalYear, onFormSubmit, closeDialog }: { fiscalYear?: FiscalYear, onFormSubmit: (data: FiscalYearFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FiscalYearFormInput>({
    resolver: zodResolver(FiscalYearSchema),
    defaultValues: fiscalYear || { name: '', startDate: '', endDate: '', isClosed: false },
  });
  const isEditingClosed = fiscalYear?.isClosed;
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div><Label htmlFor="name">Nombre del Año Fiscal (Ej: Año Fiscal 2024)</Label><Input id="name" {...register("name")} disabled={isEditingClosed} />{errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}</div>
      <div><Label htmlFor="startDate">Fecha de Inicio</Label><Input id="startDate" type="date" {...register("startDate")} disabled={isEditingClosed} />{errors.startDate && <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>}</div>
      <div><Label htmlFor="endDate">Fecha de Fin</Label><Input id="endDate" type="date" {...register("endDate")} disabled={isEditingClosed} />{errors.endDate && <p className="text-sm text-destructive mt-1">{errors.endDate.message}</p>}</div>
      {isEditingClosed && <p className="text-sm text-destructive">Este año fiscal está cerrado y no se puede modificar.</p>}
      <DialogFooter><Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button><Button type="submit" disabled={isSubmitting || isEditingClosed}>{isSubmitting ? "Guardando..." : "Guardar Año Fiscal"}</Button></DialogFooter>
    </form>
  );
}

function CompanyAccountingSettingsForm({ settings, fiscalYears, accounts, onFormSubmit, closeDialog }: { settings: CompanyAccountingSettingsFormInput | null, fiscalYears: FiscalYear[], accounts: AccountWithDetails[], onFormSubmit: (data: CompanyAccountingSettingsFormInput) => Promise<void>, closeDialog: () => void }) {
    const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<CompanyAccountingSettingsFormInput>({
        resolver: zodResolver(CompanyAccountingSettingsSchema),
        defaultValues: settings || { currentFiscalYearId: undefined, retainedEarningsAccountId: undefined },
    });
    return (
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div>
                <Label htmlFor="currentFiscalYearId">Año Fiscal Activo</Label>
                <Controller name="currentFiscalYearId" control={control} render={({ field }) => (
                    <Select onValueChange={(value) => field.onChange(value ? Number(value) : null)} defaultValue={field.value?.toString() || ""}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar año fiscal activo..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Ninguno</SelectItem>
                            {fiscalYears.filter(fy => !fy.isClosed).map(fy => <SelectItem key={fy.id} value={fy.id.toString()}>{fy.name} ({fy.startDate} - {fy.endDate})</SelectItem>)}
                        </SelectContent>
                    </Select>
                )} />
                {errors.currentFiscalYearId && <p className="text-sm text-destructive mt-1">{errors.currentFiscalYearId.message}</p>}
            </div>
            <div>
                <Label htmlFor="retainedEarningsAccountId">Cuenta de Resultados Acumulados (Patrimonio)</Label>
                <Controller name="retainedEarningsAccountId" control={control} render={({ field }) => (
                    <Select onValueChange={(value) => field.onChange(value ? Number(value) : null)} defaultValue={field.value?.toString() || ""}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">Ninguna</SelectItem>
                            {accounts.filter(acc => acc.type === 'Patrimonio').map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )} />
                {errors.retainedEarningsAccountId && <p className="text-sm text-destructive mt-1">{errors.retainedEarningsAccountId.message}</p>}
            </div>
            <DialogFooter>
                 <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando..." : "Guardar Configuración"}</Button>
            </DialogFooter>
        </form>
    );
}


export default function AccountingPage() {
  // ... (estados existentes)
  const [chartOfAccounts, setChartOfAccounts] = useState<AccountWithDetails[]>([]);
  const [journalEntries, setJournalEntries] = useState<(JournalEntryFormInput & { id: string })[]>([]);
  const [balancesSummary, setBalancesSummary] = useState<BalancesSummary>({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 });
  const [incomeExpenseChartData, setIncomeExpenseChartData] = useState<MonthlyIncomeExpense[]>([]);
  const { toast } = useToast();

  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountWithDetails | undefined>(undefined);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

  const [viewingJournalEntry, setViewingJournalEntry] = useState<(JournalEntryFormInput & { id: string }) | undefined>(undefined);
  const [isJournalEntryViewDialogOpen, setIsJournalEntryViewDialogOpen] = useState(false);

  const [balanceSheetData, setBalanceSheetData] = useState<BalanceSheetData | null>(null);
  const [isBalanceSheetLoading, setIsBalanceSheetLoading] = useState(false);
  const [incomeStatementData, setIncomeStatementData] = useState<IncomeStatementData | null>(null);
  const [isIncomeStatementLoading, setIsIncomeStatementLoading] = useState(false);

  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [isFiscalYearDialogOpen, setIsFiscalYearDialogOpen] = useState(false);
  const [editingFiscalYear, setEditingFiscalYear] = useState<FiscalYear | undefined>(undefined);
  const [deletingFiscalYearId, setDeletingFiscalYearId] = useState<number | null>(null);
  const [companyAccSettings, setCompanyAccSettings] = useState<CompanyAccountingSettingsFormInput | null>(null);
  const [isCompanySettingsDialogOpen, setIsCompanySettingsDialogOpen] = useState(false);
  const [isClosingYear, setIsClosingYear] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");


  const activeFiscalYearForReports = useMemo(() => {
    if (!companyAccSettings?.currentFiscalYearId) return null;
    return fiscalYears.find(fy => fy.id === companyAccSettings.currentFiscalYearId) || null;
  }, [companyAccSettings, fiscalYears]);

  const refreshAllAccountingData = async () => {
    try {
        const currentSettings = await getCompanyAccountingSettings();
        setCompanyAccSettings(currentSettings);
        const fyIdForFetch = currentSettings?.currentFiscalYearId || undefined;

        const [accountsData, journalEntriesData, summaryData, chartData, fiscalYearsData] = await Promise.all([
            getAccounts(),
            getJournalEntries(fyIdForFetch),
            getAccountBalancesSummary(fyIdForFetch),
            getIncomeVsExpenseChartData(6, fyIdForFetch),
            getFiscalYears(),
        ]);
        setChartOfAccounts(accountsData);
        setJournalEntries(journalEntriesData);
        setBalancesSummary(summaryData);
        setIncomeExpenseChartData(chartData);
        setFiscalYears(fiscalYearsData);

    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos contables." });
        console.error("Error refreshing accounting data:", error);
    }
  };

  useEffect(() => {
    refreshAllAccountingData();
  }, []);


  const handleAccountSubmit = async (data: AccountFormInput) => {
    const response = editingAccount ? await updateAccount({ ...data, id: editingAccount.id }) : await addAccount(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive", errors: response.errors });
    if (response.success) { refreshAllAccountingData(); setIsAccountDialogOpen(false); setEditingAccount(undefined); }
  };

  const handleDeleteAccountConfirm = async () => {
    if (!deletingAccountId) return;
    const response = await deleteAccount(deletingAccountId);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if(response.success) refreshAllAccountingData();
    setDeletingAccountId(null);
  };

  const handleGenerateBalanceSheet = async () => {
    if (!activeFiscalYearForReports) {
        toast({ variant: "destructive", title: "Error", description: "Seleccione un año fiscal activo en Configuración." });
        return;
    }
    setIsBalanceSheetLoading(true); setBalanceSheetData(null);
    try {
      const data = await generateBalanceSheet(activeFiscalYearForReports.id);
      setBalanceSheetData(data);
    } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo generar el Balance General." }); console.error("Error generating balance sheet:", error); }
    finally { setIsBalanceSheetLoading(false); }
  };

  const handleGenerateIncomeStatement = async () => {
     if (!activeFiscalYearForReports) {
        toast({ variant: "destructive", title: "Error", description: "Seleccione un año fiscal activo en Configuración." });
        return;
    }
    setIsIncomeStatementLoading(true); setIncomeStatementData(null);
    try {
      const data = await generateIncomeStatement(activeFiscalYearForReports.id);
      setIncomeStatementData(data);
    } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo generar el Estado de Resultados." }); console.error("Error generating income statement:", error); }
    finally { setIsIncomeStatementLoading(false); }
  };

  const handleFiscalYearSubmit = async (data: FiscalYearFormInput) => {
    const response = editingFiscalYear ? await updateFiscalYear(editingFiscalYear.id, data) : await addFiscalYear(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive", errors: response.errors });
    if (response.success) { refreshAllAccountingData(); setIsFiscalYearDialogOpen(false); setEditingFiscalYear(undefined); }
  };

  const handleDeleteFiscalYearConfirm = async () => {
    if (!deletingFiscalYearId) return;
    const response = await deleteFiscalYear(deletingFiscalYearId);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive" });
    if(response.success) refreshAllAccountingData();
    setDeletingFiscalYearId(null);
  };

  const handleCompanySettingsSubmit = async (data: CompanyAccountingSettingsFormInput) => {
    const response = await updateCompanyAccountingSettings(data);
    toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive", errors: response.errors });
    if (response.success) { refreshAllAccountingData(); setIsCompanySettingsDialogOpen(false); }
  };

  const handleCloseFiscalYear = async () => {
      const activeFY = fiscalYears.find(fy => fy.id === companyAccSettings?.currentFiscalYearId && !fy.isClosed);
      if (!activeFY) {
          toast({ variant: "destructive", title: "Error", description: "No hay un año fiscal activo abierto para cerrar o no se ha seleccionado cuenta de resultados acumulados." });
          return;
      }
      setIsClosingYear(true);
      const response = await closeFiscalYearProcess();
      toast({ title: response.success ? "Éxito" : "Error", description: response.message, variant: response.success ? "default" : "destructive", duration: response.success ? 8000 : 5000 });
      if(response.success) { refreshAllAccountingData(); }
      setIsClosingYear(false);
  };


  const renderAccountsRows = (accountsToRender: AccountWithDetails[], level = 0): JSX.Element[] => { /* ... (sin cambios) ... */
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
        <CardHeader><div className="flex items-center gap-3"><Calculator className="h-8 w-8 text-primary" /><div><CardTitle className="text-3xl font-bold">Contabilidad</CardTitle><CardDescription className="text-lg text-muted-foreground">Gestión financiera y salud del negocio. Año fiscal para informes: {activeFiscalYearForReports?.name || "No definido"}</CardDescription></div></div></CardHeader>
        <CardContent>
          <Tabs defaultValue="dashboard" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
              <TabsTrigger value="dashboard"><BarChart3 className="mr-2 h-4 w-4" />Panel Contable</TabsTrigger>
              <TabsTrigger value="chartOfAccounts"><Library className="mr-2 h-4 w-4"/>Plan de Cuentas</TabsTrigger>
              <TabsTrigger value="journalEntries"><FilePenLine className="mr-2 h-4 w-4"/>Libro Diario</TabsTrigger>
              <TabsTrigger value="reports"><FileText className="mr-2 h-4 w-4"/>Informes</TabsTrigger>
              <TabsTrigger value="fiscalYears"><CalendarDays className="mr-2 h-4 w-4"/>Año Fiscal y Cierre</TabsTrigger>
              <TabsTrigger value="reconciliation"><Landmark className="mr-2 h-4 w-4"/>Conciliación</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Ingresos Totales ({activeFiscalYearForReports?.name || "Actual"})</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">€{balancesSummary.totalRevenue.toFixed(2)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Gastos Totales ({activeFiscalYearForReports?.name || "Actual"})</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">€{balancesSummary.totalExpenses.toFixed(2)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Beneficio Neto ({activeFiscalYearForReports?.name || "Actual"})</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">€{balancesSummary.netProfit.toFixed(2)}</div><p className={`text-xs ${balancesSummary.netProfit >= 0 ? 'text-green-600 dark:text-green-300' : 'text-destructive'}`}>{balancesSummary.netProfit >=0 ? 'Positivo' : 'Negativo'}</p></CardContent></Card>
              </div>
              <Card><CardHeader><CardTitle>Resumen de Ingresos vs Gastos</CardTitle><CardDescription>Rendimiento de los últimos meses {activeFiscalYearForReports ? `del año fiscal ${activeFiscalYearForReports.name}` : '(global)'}.</CardDescription></CardHeader>
                <CardContent className="h-[300px] w-full">
                  {incomeExpenseChartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <ResponsiveContainer width="100%" height="100%"><BarChart data={incomeExpenseChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} /><YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `€${value/1000}k`} /><ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} /><ChartLegend content={<ChartLegendContent />} /><Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} /><Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} /></BarChart></ResponsiveContainer>
                    </ChartContainer>
                  ) : (<div className="flex items-center justify-center h-full text-muted-foreground">Cargando datos del gráfico o no hay datos para el período seleccionado...</div>)}
                  </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chartOfAccounts" className="mt-6">
              <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold">Plan de Cuentas</h3><Button onClick={() => { setEditingAccount(undefined); setIsAccountDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4"/> Añadir Cuenta</Button></div>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">S. Directo</TableHead><TableHead className="text-right">S. Acumulado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{chartOfAccounts.length > 0 ? renderAccountsRows(rootAccounts) : <TableRow><TableCell colSpan={6} className="text-center">No hay cuentas contables definidas.</TableCell></TableRow>}</TableBody></Table></div>
            </TabsContent>

            <TabsContent value="journalEntries" className="mt-6">
               <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-semibold">Libro Diario ({activeFiscalYearForReports?.name || "Global"})</h3></div>
               <p className="text-sm text-muted-foreground mb-4">Los asientos se generan automáticamente. La edición/reversión manual requiere herramientas avanzadas o se realiza a través de asientos de ajuste.</p>
              <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>N° Asiento</TableHead><TableHead>Descripción</TableHead><TableHead>Cta. Débito</TableHead><TableHead>Cta. Crédito</TableHead><TableHead className="text-right">Monto</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{journalEntries.map(entry => (<TableRow key={entry.id}><TableCell>{entry.date}</TableCell><TableCell>{entry.entryNumber}</TableCell><TableCell className="font-medium max-w-xs truncate">{entry.description}</TableCell><TableCell>{entry.debitAccountCode} - {chartOfAccounts.find(acc=>acc.code === entry.debitAccountCode)?.name}</TableCell><TableCell>{entry.creditAccountCode} - {chartOfAccounts.find(acc=>acc.code === entry.creditAccountCode)?.name}</TableCell><TableCell className="text-right">€{Number(entry.amount).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setViewingJournalEntry(entry); setIsJournalEntryViewDialogOpen(true);}}><FileText className="mr-1 h-4 w-4"/>Ver</Button>
                  </TableCell></TableRow>))}
                  {journalEntries.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No hay asientos contables registrados {activeFiscalYearForReports ? `para el año fiscal ${activeFiscalYearForReports.name}` : 'para el período actual (o no hay año fiscal activo)'}.</TableCell></TableRow>}
                </TableBody></Table>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Informes Financieros</CardTitle>
                        <div className="flex justify-between items-center">
                        <CardDescription>Genera balances y estados de resultados para el año fiscal: <span className="font-semibold">{activeFiscalYearForReports?.name || "No Definido"}</span></CardDescription>
                         <Select
                            value={activeFiscalYearForReports?.id?.toString() || ""}
                            onValueChange={(value) => {
                                const selectedId = value ? parseInt(value) : null;
                                const selectedFY = fiscalYears.find(fy => fy.id === selectedId) || null;
                                setActiveFiscalYearForReports(selectedFY);
                                // No es necesario llamar a refreshAllAccountingData aquí si el useEffect ya lo hace
                            }}
                            >
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Seleccionar año fiscal para informes..." />
                            </SelectTrigger>
                            <SelectContent>
                                {fiscalYears.map(fy => (
                                <SelectItem key={fy.id} value={fy.id.toString()}>
                                    {fy.name} ({fy.startDate} - {fy.endDate}) {fy.isClosed ? "(Cerrado)" : ""}
                                </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex gap-4 mb-6">
                            <Button onClick={handleGenerateBalanceSheet} disabled={isBalanceSheetLoading || !activeFiscalYearForReports}> {isBalanceSheetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generar Balance General</Button>
                            <Button onClick={handleGenerateIncomeStatement} disabled={isIncomeStatementLoading || !activeFiscalYearForReports}> {isIncomeStatementLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generar Estado de Resultados</Button>
                        </div>
                        {!activeFiscalYearForReports && <p className="text-destructive"><AlertTriangle className="inline mr-2 h-4 w-4"/>Por favor, selecciona o configura un año fiscal activo en la pestaña "Año Fiscal y Cierre" para generar informes.</p>}
                        
                        {isBalanceSheetLoading && <div className="text-center p-4"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p>Generando Balance General...</p></div>}
                        {balanceSheetData && (
                            <Card>
                                <CardHeader><CardTitle>Balance General al {new Date(balanceSheetData.reportDate).toLocaleDateString()}</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div><h4 className="font-semibold mb-2">Activos</h4><Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader><TableBody>{balanceSheetData.assets.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}<TableRow className="font-bold"><TableCell>Total Activos</TableCell><TableCell className="text-right">{balanceSheetData.totalAssets.toFixed(2)}</TableCell></TableRow></TableBody></Table></div>
                                        <div><h4 className="font-semibold mb-2">Pasivos</h4><Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader><TableBody>{balanceSheetData.liabilities.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{Math.abs(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}<TableRow className="font-bold"><TableCell>Total Pasivos</TableCell><TableCell className="text-right">{balanceSheetData.totalLiabilities.toFixed(2)}</TableCell></TableRow></TableBody></Table></div>
                                        <div><h4 className="font-semibold mb-2">Patrimonio</h4><Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader><TableBody>{balanceSheetData.equity.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{Math.abs(acc.rolledUpBalance ?? acc.balance).toFixed(2)}</TableCell></TableRow>)}<TableRow className="font-bold"><TableCell>Total Patrimonio</TableCell><TableCell className="text-right">{balanceSheetData.totalEquity.toFixed(2)}</TableCell></TableRow></TableBody></Table></div>
                                    </div>
                                    <div className="mt-4 font-bold text-lg">Total Pasivos + Patrimonio: €{balanceSheetData.totalLiabilitiesAndEquity.toFixed(2)}</div>
                                    {Math.abs(balanceSheetData.totalAssets - balanceSheetData.totalLiabilitiesAndEquity) > 0.01 && (<p className="text-destructive mt-2">¡Descuadre! Total Activos no es igual a Total Pasivos + Patrimonio.</p>)}
                                </CardContent>
                            </Card>
                        )}

                        {isIncomeStatementLoading && <div className="text-center p-4"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p>Generando Estado de Resultados...</p></div>}
                        {incomeStatementData && (
                            <Card className="mt-6">
                                <CardHeader><CardTitle>Estado de Resultados del Período: {incomeStatementData.reportPeriod}</CardTitle></CardHeader>
                                <CardContent>
                                    <h4 className="font-semibold mb-2">Ingresos</h4><Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader><TableBody>{incomeStatementData.revenues.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{Math.abs(acc.balance).toFixed(2)}</TableCell></TableRow>)}<TableRow className="font-bold"><TableCell>Total Ingresos</TableCell><TableCell className="text-right">{incomeStatementData.totalRevenues.toFixed(2)}</TableCell></TableRow></TableBody></Table>
                                    <h4 className="font-semibold mt-4 mb-2">Gastos</h4><Table><TableHeader><TableRow><TableHead>Cuenta</TableHead><TableHead className="text-right">Saldo (€)</TableHead></TableRow></TableHeader><TableBody>{incomeStatementData.expenses.map(acc => <TableRow key={acc.id}><TableCell>{acc.code} - {acc.name}</TableCell><TableCell className="text-right">{(acc.balance).toFixed(2)}</TableCell></TableRow>)}<TableRow className="font-bold"><TableCell>Total Gastos</TableCell><TableCell className="text-right">{incomeStatementData.totalExpenses.toFixed(2)}</TableCell></TableRow></TableBody></Table>
                                    <div className={`mt-4 font-bold text-lg ${incomeStatementData.netIncome >= 0 ? 'text-green-600 dark:text-green-300' : 'text-destructive'}`}>Beneficio Neto (Pérdida): €{incomeStatementData.netIncome.toFixed(2)}</div>
                                </CardContent>
                            </Card>
                        )}
                         {!isBalanceSheetLoading && !balanceSheetData && !isIncomeStatementLoading && !incomeStatementData && activeFiscalYearForReports && (
                            <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center"><FileText className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">Selecciona un informe para generar.</p></div>
                         )}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="fiscalYears" className="mt-6 space-y-6">
                <Card>
                    <CardHeader className="flex flex-row justify-between items-center">
                        <CardTitle>Configuración Contable</CardTitle>
                        <Button variant="outline" onClick={() => setIsCompanySettingsDialogOpen(true)}><Settings2 className="mr-2 h-4 w-4"/>Configurar</Button>
                    </CardHeader>
                    <CardContent>
                        <p>Año Fiscal Activo: <span className="font-semibold">{fiscalYears.find(fy => fy.id === companyAccSettings?.currentFiscalYearId)?.name || "No definido"}</span></p>
                        <p>Cuenta de Resultados Acumulados: <span className="font-semibold">{chartOfAccounts.find(acc => acc.id === companyAccSettings?.retainedEarningsAccountId?.toString())?.name || "No definida"}</span></p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row justify-between items-center"><CardTitle>Años Fiscales</CardTitle><Button onClick={() => { setEditingFiscalYear(undefined); setIsFiscalYearDialogOpen(true);}}><PlusCircle className="mr-2 h-4 w-4"/>Nuevo Año Fiscal</Button></CardHeader>
                    <CardContent>
                        <Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Inicio</TableHead><TableHead>Fin</TableHead><TableHead>Estado</TableHead><TableHead>Cerrado Por</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {fiscalYears.map(fy => (
                                    <TableRow key={fy.id}>
                                        <TableCell>{fy.name}</TableCell><TableCell>{fy.startDate}</TableCell><TableCell>{fy.endDate}</TableCell>
                                        <TableCell>{fy.isClosed ? <Badge variant="destructive">Cerrado</Badge> : <Badge variant="default" className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">Abierto</Badge>}</TableCell>
                                        <TableCell>{fy.isClosed ? `${fy.closed_by_username || 'Sistema'} el ${fy.closed_at ? new Date(fy.closed_at).toLocaleDateString() : ''}` : 'N/A'}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" onClick={() => { setEditingFiscalYear(fy); setIsFiscalYearDialogOpen(true);}} disabled={fy.isClosed}><Edit className="mr-1 h-4 w-4"/>Editar</Button>
                                            <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={fy.isClosed || fy.id === companyAccSettings?.currentFiscalYearId} onClick={() => setDeletingFiscalYearId(fy.id)}><Trash2 className="mr-1 h-4 w-4"/>Eliminar</Button></AlertDialogTrigger>
                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Eliminar Año Fiscal?</AlertDialogTitle><AlertDialogDescription>Se eliminará {fiscalYears.find(f => f.id === deletingFiscalYearId)?.name}. No se puede eliminar si está cerrado, es el año fiscal activo actual o tiene asientos asociados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingFiscalYearId(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteFiscalYearConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                 {fiscalYears.length === 0 && <TableRow><TableCell colSpan={6} className="text-center">No hay años fiscales definidos.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle>Proceso de Cierre de Año Fiscal</CardTitle><CardDescription>Cierra el año fiscal activo actual ({fiscalYears.find(fy => fy.id === companyAccSettings?.currentFiscalYearId && !fy.isClosed)?.name || "Ninguno Seleccionado o ya Cerrado"}). Esta acción es irreversible para el año cerrado.</CardDescription></CardHeader>
                    <CardContent>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={!companyAccSettings?.currentFiscalYearId || !!fiscalYears.find(fy => fy.id === companyAccSettings?.currentFiscalYearId)?.isClosed || isClosingYear || !companyAccSettings?.retainedEarningsAccountId}>
                                    {isClosingYear && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Iniciar Cierre del Año Fiscal Activo
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Confirmar Cierre de Año Fiscal?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Estás a punto de cerrar el año fiscal: <strong>{fiscalYears.find(fy => fy.id === companyAccSettings?.currentFiscalYearId)?.name}</strong>.
                                    Esto generará los asientos de cierre, pondrá a cero los saldos de las cuentas de resultados y transferirá el beneficio/pérdida a la cuenta de Resultados Acumulados.
                                    Esta acción NO SE PUEDE DESHACER para el año fiscal cerrado. ¿Deseas continuar?
                                </AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleCloseFiscalYear} className="bg-destructive hover:bg-destructive/90">Sí, Cerrar Año Fiscal</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                         {!companyAccSettings?.currentFiscalYearId && <p className="text-sm text-muted-foreground mt-2">No hay un año fiscal activo seleccionado en la configuración.</p>}
                         {companyAccSettings?.currentFiscalYearId && fiscalYears.find(fy => fy.id === companyAccSettings?.currentFiscalYearId)?.isClosed && <p className="text-sm text-muted-foreground mt-2">El año fiscal activo actual ya está cerrado.</p>}
                         {!companyAccSettings?.retainedEarningsAccountId && <p className="text-sm text-destructive mt-2"><AlertTriangle className="inline mr-1 h-4 w-4"/>Se requiere una cuenta de Resultados Acumulados en la configuración para el cierre.</p>}
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
      <Dialog open={isJournalEntryViewDialogOpen} onOpenChange={(isOpen) => { setIsJournalEntryViewDialogOpen(isOpen); if(!isOpen) setViewingJournalEntry(undefined);}}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Ver Asiento: {viewingJournalEntry?.entryNumber}</DialogTitle><DialogDescription>Detalles del asiento contable.</DialogDescription></DialogHeader>
        {viewingJournalEntry && (
            <div className="space-y-4 mt-4">
                <p><strong>Fecha:</strong> {viewingJournalEntry.date}</p>
                <p><strong>Descripción:</strong> {viewingJournalEntry.description}</p>
                <p><strong>Cta. Débito:</strong> {viewingJournalEntry.debitAccountCode} - {chartOfAccounts.find(acc => acc.code === viewingJournalEntry.debitAccountCode)?.name}</p>
                <p><strong>Cta. Crédito:</strong> {viewingJournalEntry.creditAccountCode} - {chartOfAccounts.find(acc => acc.code === viewingJournalEntry.creditAccountCode)?.name}</p>
                <p><strong>Monto:</strong> €{Number(viewingJournalEntry.amount).toFixed(2)}</p>
                 <DialogFooter><Button type="button" variant="outline" onClick={() => { setIsJournalEntryViewDialogOpen(false); setViewingJournalEntry(undefined); }}>Cerrar</Button></DialogFooter>
            </div>
        )}
        </DialogContent>
      </Dialog>
      <Dialog open={isFiscalYearDialogOpen} onOpenChange={(isOpen) => { setIsFiscalYearDialogOpen(isOpen); if(!isOpen) setEditingFiscalYear(undefined);}}>
          <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editingFiscalYear ? "Editar Año Fiscal" : "Nuevo Año Fiscal"}</DialogTitle></DialogHeader><FiscalYearForm fiscalYear={editingFiscalYear} onFormSubmit={handleFiscalYearSubmit} closeDialog={() => { setIsFiscalYearDialogOpen(false); setEditingFiscalYear(undefined);}} /></DialogContent>
      </Dialog>
       <Dialog open={isCompanySettingsDialogOpen} onOpenChange={setIsCompanySettingsDialogOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Configuración Contable de la Empresa</DialogTitle><DialogDescription>Define el año fiscal activo y la cuenta de resultados.</DialogDescription></DialogHeader>
          {isCompanySettingsDialogOpen && <CompanyAccountingSettingsForm settings={companyAccSettings} fiscalYears={fiscalYears} accounts={chartOfAccounts} onFormSubmit={handleCompanySettingsSubmit} closeDialog={() => setIsCompanySettingsDialogOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
