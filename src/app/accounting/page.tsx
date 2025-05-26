
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, PlusCircle, Search, Filter, FileText, DollarSign, TrendingUp, TrendingDown, BarChart3, Landmark, FilePenLine } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"

const chartData = [
  { month: "Enero", revenue: 1860, expenses: 800 },
  { month: "Febrero", revenue: 3050, expenses: 1200 },
  { month: "Marzo", revenue: 2370, expenses: 950 },
  { month: "Abril", revenue: 730, expenses: 1100 },
  { month: "Mayo", revenue: 2090, expenses: 850 },
  { month: "Junio", revenue: 2140, expenses: 920 },
]

const chartConfig = {
  revenue: {
    label: "Ingresos",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Gastos",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

interface Account {
  id: string;
  code: string;
  name: string;
  type: "Activo" | "Pasivo" | "Patrimonio" | "Ingreso" | "Gasto";
  balance: number;
}
const chartOfAccountsData: Account[] = [
  { id: "1", code: "1010", name: "Efectivo", type: "Activo", balance: 25000.75 },
  { id: "2", code: "1200", name: "Cuentas por Cobrar", type: "Activo", balance: 12500.00 },
  { id: "3", code: "2010", name: "Cuentas por Pagar", type: "Pasivo", balance: 8750.50 },
  { id: "4", code: "3010", name: "Patrimonio Neto", type: "Patrimonio", balance: 50000.00 },
  { id: "5", code: "4010", name: "Ingresos por Ventas", type: "Ingreso", balance: 75000.25 },
  { id: "6", code: "5010", name: "Gastos de Oficina", type: "Gasto", balance: 5250.00 },
];

interface JournalEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
}
const journalEntriesData: JournalEntry[] = [
 { id: "1", date: "2024-07-01", entryNumber: "JE-001", description: "Venta en efectivo", debitAccount: "1010 Efectivo", creditAccount: "4010 Ingresos por Ventas", amount: 500.00 },
 { id: "2", date: "2024-07-02", entryNumber: "JE-002", description: "Pago de alquiler de oficina", debitAccount: "5010 Gastos de Oficina", creditAccount: "1010 Efectivo", amount: 1200.00 },
];

export default function AccountingPage() {
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
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Añadir Cuenta</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nombre de Cuenta</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartOfAccountsData.map(acc => (
                      <TableRow key={acc.id}>
                        <TableCell>{acc.code}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell>{acc.type}</TableCell>
                        <TableCell className="text-right">€{acc.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="journalEntries" className="mt-6">
               <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Asientos Contables</h3>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Nuevo Asiento Contable</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>N° Asiento</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Cuenta de Débito</TableHead>
                      <TableHead>Cuenta de Crédito</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntriesData.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.entryNumber}</TableCell>
                        <TableCell className="font-medium">{entry.description}</TableCell>
                        <TableCell>{entry.debitAccount}</TableCell>
                        <TableCell>{entry.creditAccount}</TableCell>
                        <TableCell className="text-right">€{entry.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
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
                <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">Estado de Flujo de Efectivo</p>
                    <p className="text-xs text-muted-foreground text-left">Seguimiento de entradas y salidas de efectivo.</p>
                  </div>
                </Button>
                 <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">Balance de Comprobación</p>
                    <p className="text-xs text-muted-foreground text-left">Verificar saldos deudores y acreedores.</p>
                  </div>
                </Button>
                 <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">Libro Mayor General</p>
                    <p className="text-xs text-muted-foreground text-left">Ver historial detallado de transacciones.</p>
                  </div>
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="reconciliation" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Conciliación Bancaria</h3>
                 <Button><Landmark className="mr-2 h-4 w-4"/> Iniciar Nueva Conciliación</Button>
              </div>
              <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20 p-8 text-center">
                <div>
                  <Landmark className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Las funciones de conciliación bancaria se implementarán aquí.</p>
                  <p className="text-xs text-muted-foreground mt-1">Conecta cuentas bancarias, concilia transacciones y asegura la precisión de tus registros.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
