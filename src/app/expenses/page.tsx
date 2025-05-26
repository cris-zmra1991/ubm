
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, FileText, DollarSign, TrendingUp, TrendingDown, CheckCircle, XCircle, Hourglass, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  vendor?: string;
  status: "Enviado" | "Aprobado" | "Rechazado" | "Pagado";
  receiptUrl?: string;
}

const expensesData: Expense[] = [
  { id: "1", date: "2024-07-01", category: "Suministros de Oficina", description: "Papel para impresora y bolígrafos", amount: 45.50, vendor: "Office Depot", status: "Pagado", receiptUrl: "#" },
  { id: "2", date: "2024-07-05", category: "Viajes", description: "Vuelo a conferencia", amount: 350.00, status: "Aprobado" },
  { id: "3", date: "2024-07-10", category: "Suscripción de Software", description: "Adobe CC mensual", amount: 59.99, status: "Pagado" },
  { id: "4", date: "2024-07-15", category: "Marketing", description: "Campaña publicitaria en redes sociales", amount: 200.00, status: "Enviado" },
  { id: "5", date: "2024-07-18", category: "Servicios Públicos", description: "Factura de electricidad", amount: 120.75, status: "Rechazado" },
];

const getStatusBadge = (status: Expense["status"]) => {
  switch (status) {
    case "Enviado":
      return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><Hourglass className="mr-1 h-3 w-3" />Enviado</Badge>;
    case "Aprobado":
      return <Badge variant="outline" className="border-green-500/70 bg-green-500/10 text-green-700 dark:text-green-400"><CheckCircle className="mr-1 h-3 w-3" />Aprobado</Badge>;
    case "Rechazado":
      return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Rechazado</Badge>;
    case "Pagado":
      return <Badge variant="default" className="bg-green-600/20 text-green-800 dark:bg-green-700/30 dark:text-green-300 border-green-600/30"><CreditCard className="mr-1 h-3 w-3" />Pagado</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-3xl font-bold">Seguimiento de Gastos</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Registra, gestiona y analiza todos los gastos del negocio.
                </CardDescription>
              </div>
            </div>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Gasto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Totales (Este Mes)</CardTitle>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{expensesData.reduce((sum, ex) => sum + ex.amount, 0).toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">+5.2% del mes pasado</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendiente de Aprobación</CardTitle>
                <Hourglass className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expensesData.filter(ex => ex.status === "Enviado").length}</div>
                <p className="text-xs text-muted-foreground">€{expensesData.filter(ex => ex.status === "Enviado").reduce((sum, ex) => sum + ex.amount, 0).toFixed(2)} en total</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Rechazados</CardTitle>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expensesData.filter(ex => ex.status === "Rechazado").length}</div>
                 <p className="text-xs text-muted-foreground">€{expensesData.filter(ex => ex.status === "Rechazado").reduce((sum, ex) => sum + ex.amount, 0).toFixed(2)} en total</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar gastos (ej., categoría, proveedor, monto)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Recibo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expensesData.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.date}</TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{expense.description}</TableCell>
                    <TableCell>{expense.vendor || "N/D"}</TableCell>
                    <TableCell className="text-right">€{expense.amount.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(expense.status)}</TableCell>
                    <TableCell>
                      {expense.receiptUrl ? (
                        <Button variant="link" size="sm" asChild className="p-0 h-auto">
                          <Link href={expense.receiptUrl} target="_blank">Ver</Link>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">Ninguno</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                          </DropdownMenuItem>
                          {expense.status === "Enviado" && (
                            <>
                              <DropdownMenuItem>
                                <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                <XCircle className="mr-2 h-4 w-4" /> Rechazar
                              </DropdownMenuItem>
                            </>
                          )}
                          {expense.status === "Aprobado" && (
                            <DropdownMenuItem>
                                <CreditCard className="mr-2 h-4 w-4" /> Marcar como Pagado
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {expensesData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Aún no se han registrado gastos.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Mostrando {expensesData.length} de {expensesData.length} gastos.</p>
          {/* Pagination placeholder */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
