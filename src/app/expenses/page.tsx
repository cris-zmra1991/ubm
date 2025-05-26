
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, FileText, DollarSign, CheckCircle, XCircle, Hourglass, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExpenseSchema, type ExpenseFormInput, addExpense, updateExpense, deleteExpense, getExpenses } from "@/app/actions/expenses.actions";
import { useToast } from "@/hooks/use-toast";

const initialExpensesData: ExpenseFormInput[] = [
  { id: "1", date: "2024-07-01", category: "Suministros de Oficina", description: "Papel para impresora y bolígrafos", amount: 45.50, vendor: "Office Depot", status: "Pagado", receiptUrl: "#" },
  { id: "2", date: "2024-07-05", category: "Viajes", description: "Vuelo a conferencia", amount: 350.00, status: "Aprobado", vendor: "Aerolínea Fantasía" },
  { id: "3", date: "2024-07-10", category: "Suscripción de Software", description: "Adobe CC mensual", amount: 59.99, status: "Pagado", vendor: "Adobe Inc." },
  { id: "4", date: "2024-07-15", category: "Marketing", description: "Campaña publicitaria en redes sociales", amount: 200.00, status: "Enviado", vendor: "Meta Ads" },
  { id: "5", date: "2024-07-18", category: "Servicios Públicos", description: "Factura de electricidad", amount: 120.75, status: "Rechazado", vendor: "Compañía Eléctrica" },
];

const getStatusBadge = (status: ExpenseFormInput["status"]) => {
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

function ExpenseForm({ expense, onFormSubmit, closeDialog }: { expense?: ExpenseFormInput, onFormSubmit: (data: ExpenseFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ExpenseFormInput>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: expense || {
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      amount: 0,
      vendor: '',
      status: 'Enviado',
      receiptUrl: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
      </div>
      <div>
        <Label htmlFor="category">Categoría</Label>
        <Input id="category" {...register("category")} />
        {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" {...register("description")} />
        {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
      </div>
      <div>
        <Label htmlFor="amount">Monto (€)</Label>
        <Input id="amount" type="number" step="0.01" {...register("amount")} />
        {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
      </div>
      <div>
        <Label htmlFor="vendor">Proveedor (Opcional)</Label>
        <Input id="vendor" {...register("vendor")} />
        {errors.vendor && <p className="text-sm text-destructive mt-1">{errors.vendor.message}</p>}
      </div>
       <div>
        <Label htmlFor="receiptUrl">URL del Recibo (Opcional)</Label>
        <Input id="receiptUrl" type="url" {...register("receiptUrl")} placeholder="https://ejemplo.com/recibo.pdf"/>
        {errors.receiptUrl && <p className="text-sm text-destructive mt-1">{errors.receiptUrl.message}</p>}
      </div>
      <div>
        <Label htmlFor="status">Estado</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Seleccionar estado..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Enviado">Enviado</SelectItem>
                <SelectItem value="Aprobado">Aprobado</SelectItem>
                <SelectItem value="Rechazado">Rechazado</SelectItem>
                <SelectItem value="Pagado">Pagado</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && <p className="text-sm text-destructive mt-1">{errors.status.message}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (expense ? "Guardando..." : "Añadiendo...") : (expense ? "Guardar Cambios" : "Añadir Gasto")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseFormInput[]>(initialExpensesData);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseFormInput | undefined>(undefined);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const { toast } = useToast();

  // TODO: Cargar datos del servidor
  // useEffect(() => {
  //   async function loadExpenses() {
  //     const serverExpenses = await getExpenses();
  //     setExpenses(serverExpenses);
  //   }
  //   loadExpenses();
  // }, []);

  const handleAddSubmit = async (data: ExpenseFormInput) => {
    const response = await addExpense(data);
    if (response.success && response.expense) {
      toast({ title: "Éxito", description: response.message });
      // setExpenses(prev => [...prev, response.expense!]);
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir el gasto." });
    }
  };

  const handleEditSubmit = async (data: ExpenseFormInput) => {
    if (!editingExpense?.id) return;
    const response = await updateExpense({ ...data, id: editingExpense.id });
    if (response.success && response.expense) {
      toast({ title: "Éxito", description: response.message });
      // setExpenses(prev => prev.map(ex => ex.id === response.expense?.id ? response.expense : ex));
      setIsEditDialogOpen(false);
      setEditingExpense(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar el gasto." });
    }
  };

  const handleDelete = async () => {
    if (!deletingExpenseId) return;
    const response = await deleteExpense(deletingExpenseId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      // setExpenses(prev => prev.filter(ex => ex.id !== deletingExpenseId));
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar el gasto." });
    }
    setDeletingExpenseId(null);
  };

  const openEditDialog = (expense: ExpenseFormInput) => {
    setEditingExpense(expense);
    setIsEditDialogOpen(true);
  };

  const handleStatusUpdate = async (expenseId: string, newStatus: ExpenseFormInput["status"]) => {
    const expenseToUpdate = expenses.find(ex => ex.id === expenseId);
    if (!expenseToUpdate) return;
    const response = await updateExpense({ ...expenseToUpdate, status: newStatus });
    if (response.success) {
      toast({ title: "Éxito", description: `Gasto "${expenseToUpdate.description.substring(0,20)}..." actualizado a ${newStatus}.` });
      // setExpenses(prev => prev.map(ex => ex.id === expenseId ? {...ex, status: newStatus} : ex));
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar el estado." });
    }
  };


  const totalExpensesThisMonth = expenses.reduce((sum, ex) => sum + ex.amount, 0);
  const pendingApprovalCount = expenses.filter(ex => ex.status === "Enviado").length;
  const pendingApprovalAmount = expenses.filter(ex => ex.status === "Enviado").reduce((sum, ex) => sum + ex.amount, 0);
  const rejectedCount = expenses.filter(ex => ex.status === "Rechazado").length;
  const rejectedAmount = expenses.filter(ex => ex.status === "Rechazado").reduce((sum, ex) => sum + ex.amount, 0);

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
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Gasto
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Añadir Nuevo Gasto</DialogTitle>
                        <DialogDescription>Completa los detalles para registrar un nuevo gasto.</DialogDescription>
                    </DialogHeader>
                    <ExpenseForm onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
                </DialogContent>
            </Dialog>
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
                <div className="text-2xl font-bold">€{totalExpensesThisMonth.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">+5.2% del mes pasado</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendiente de Aprobación</CardTitle>
                <Hourglass className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingApprovalCount}</div>
                <p className="text-xs text-muted-foreground">€{pendingApprovalAmount.toFixed(2)} en total</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Rechazados</CardTitle>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{rejectedCount}</div>
                 <p className="text-xs text-muted-foreground">€{rejectedAmount.toFixed(2)} en total</p>
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
                {expenses.map((expense) => (
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
                          <Link href={expense.receiptUrl} target="_blank" rel="noopener noreferrer">Ver</Link>
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
                          <DropdownMenuItem onClick={() => openEditDialog(expense)}>
                            <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                          </DropdownMenuItem>
                          {expense.status === "Enviado" && (
                            <>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(expense.id!, "Aprobado")}>
                                <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusUpdate(expense.id!, "Rechazado")} className="text-amber-600 focus:text-amber-700 dark:text-amber-500 dark:focus:text-amber-400">
                                <XCircle className="mr-2 h-4 w-4" /> Rechazar
                              </DropdownMenuItem>
                            </>
                          )}
                          {expense.status === "Aprobado" && (
                            <DropdownMenuItem onClick={() => handleStatusUpdate(expense.id!, "Pagado")}>
                                <CreditCard className="mr-2 h-4 w-4" /> Marcar como Pagado
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta acción no se puede deshacer. Se eliminará permanentemente el gasto: "{expense.description}".
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setDeletingExpenseId(null)}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => {setDeletingExpenseId(expense.id!); handleDelete();}} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {expenses.length === 0 && (
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
          <p className="text-sm text-muted-foreground">Mostrando {expenses.length} de {expenses.length} gastos.</p>
          {/* Pagination placeholder */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          </div>
        </CardFooter>
      </Card>

       {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingExpense(undefined);}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Gasto</DialogTitle>
            <DialogDescription>Actualiza los detalles del gasto.</DialogDescription>
          </DialogHeader>
          {editingExpense && <ExpenseForm expense={editingExpense} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingExpense(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
