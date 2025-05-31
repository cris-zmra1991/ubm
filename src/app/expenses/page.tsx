
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
import { ExpenseSchema } from "@/app/schemas/expenses.schemas";
import { type ExpenseFormInput, addExpense, updateExpense, deleteExpense, getExpenses } from "@/app/actions/expenses.actions";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // Importación añadida


const getStatusBadge = (status: ExpenseFormInput["status"]) => {
  switch (status) {
    case "Borrador":
      return <Badge variant="outline" className="border-yellow-500/70 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"><Hourglass className="mr-1 h-3 w-3" />Borrador</Badge>;
    case "Confirmada":
      return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Confirmada</Badge>;
    case "Pagado":
      return <Badge variant="default" className="bg-green-600/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-600/30"><CreditCard className="mr-1 h-3 w-3" />Pagado</Badge>;
    case "Cancelada":
      return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Cancelada</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

function ExpenseForm({ expense, onFormSubmit, closeDialog }: { expense?: ExpenseFormInput & {id: string}, onFormSubmit: (data: ExpenseFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<ExpenseFormInput>({
    resolver: zodResolver(ExpenseSchema),
    defaultValues: expense || {
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      amount: 0,
      vendor: '',
      status: 'Borrador', 
      receiptUrl: '',
    },
  });

  const currentStatus = expense?.status;
  const isPaidOrCancelled = currentStatus === 'Pagado' || currentStatus === 'Cancelada';
  const isConfirmed = currentStatus === 'Confirmada';

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" {...register("date")} disabled={isPaidOrCancelled} />
        {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
      </div>
      <div>
        <Label htmlFor="category">Categoría</Label>
        <Input id="category" {...register("category")} disabled={isPaidOrCancelled} />
        {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" {...register("description")} disabled={isPaidOrCancelled} />
        {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
      </div>
      <div>
        <Label htmlFor="amount">Monto (€)</Label>
        <Input id="amount" type="number" step="0.01" {...register("amount", {valueAsNumber: true})} disabled={isPaidOrCancelled} />
        {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
      </div>
      <div>
        <Label htmlFor="vendor">Proveedor (Opcional)</Label>
        <Input id="vendor" {...register("vendor")} disabled={isPaidOrCancelled} />
        {errors.vendor && <p className="text-sm text-destructive mt-1">{errors.vendor.message}</p>}
      </div>
       <div>
        <Label htmlFor="receiptUrl">URL del Recibo (Opcional)</Label>
        <Input id="receiptUrl" type="url" {...register("receiptUrl")} placeholder="https://ejemplo.com/recibo.pdf" disabled={isPaidOrCancelled}/>
        {errors.receiptUrl && <p className="text-sm text-destructive mt-1">{errors.receiptUrl.message}</p>}
      </div>
      <div>
        <Label htmlFor="status">Estado</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select 
              onValueChange={field.onChange} 
              value={field.value} 
              disabled={isPaidOrCancelled || (isConfirmed && field.value !== 'Cancelada')}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Seleccionar estado..." />
              </SelectTrigger>
              <SelectContent>
                { (currentStatus === 'Borrador' || !expense) && <SelectItem value="Borrador">Borrador</SelectItem> }
                { (currentStatus === 'Borrador' || currentStatus === 'Confirmada') && !isPaidOrCancelled && <SelectItem value="Confirmada">Confirmada</SelectItem> }
                { !isPaidOrCancelled && <SelectItem value="Cancelada">Cancelada</SelectItem> }
                { isPaidOrCancelled && <SelectItem value={currentStatus!} disabled>{currentStatus}</SelectItem> }
                 { /* La opción Pagado no debe ser seleccionable manualmente aquí */ }
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && <p className="text-sm text-destructive mt-1">{errors.status.message}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button 
          type="submit" 
          disabled={isSubmitting || isPaidOrCancelled || (isConfirmed && watch('status') !== 'Cancelada' && watch('status') !== 'Confirmada')}
        >
          {isSubmitting ? (expense ? "Guardando..." : "Añadiendo...") : (expense ? "Guardar Cambios" : "Añadir Gasto")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<(ExpenseFormInput & { id: string })[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<(ExpenseFormInput & { id: string }) | undefined>(undefined);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ExpenseFormInput["status"] | "all">("all");


  const refreshExpenses = async () => {
    const serverExpenses = await getExpenses();
    setExpenses(serverExpenses);
  };

  useEffect(() => {
    refreshExpenses();
  }, []);

  const handleAddSubmit = async (data: ExpenseFormInput) => {
    const response = await addExpense(data);
    if (response.success && response.expense) {
      toast({ title: "Éxito", description: response.message });
      refreshExpenses();
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir el gasto.", errors: response.errors });
    }
  };

  const handleEditSubmit = async (data: ExpenseFormInput) => {
    if (!editingExpense?.id) return;
    const response = await updateExpense({ ...data, id: editingExpense.id });
    if (response.success && response.expense) {
      toast({ title: "Éxito", description: response.message });
      refreshExpenses();
      setIsEditDialogOpen(false);
      setEditingExpense(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar el gasto.", errors: response.errors });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingExpenseId) return;
    const response = await deleteExpense(deletingExpenseId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      refreshExpenses();
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar el gasto." });
    }
    setDeletingExpenseId(null);
  };

  const openEditDialog = (expense: ExpenseFormInput & { id: string }) => {
    setEditingExpense(expense);
    setIsEditDialogOpen(true);
  };

  const totalExpensesThisMonth = expenses
    .filter(ex => ex.status === 'Pagado' && new Date(ex.date).getMonth() === new Date().getMonth() && new Date(ex.date).getFullYear() === new Date().getFullYear())
    .reduce((sum, ex) => sum + ex.amount, 0);
  const pendingConfirmationCount = expenses.filter(ex => ex.status === "Confirmada" && ex.status !== "Pagado").length; 
  const pendingConfirmationAmount = expenses.filter(ex => ex.status === "Confirmada" && ex.status !== "Pagado").reduce((sum, ex) => sum + ex.amount, 0);


  const filteredExpenses = expenses.filter(ex => activeTab === "all" || ex.status === activeTab);


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
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Pagados (Este Mes)</CardTitle>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{totalExpensesThisMonth.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pendiente de Pago (Confirmados)</CardTitle>
                <Hourglass className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingConfirmationCount}</div>
                <p className="text-xs text-muted-foreground">€{pendingConfirmationAmount.toFixed(2)} en total</p>
              </CardContent>
            </Card>
             <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gastos Cancelados</CardTitle>
                 <XCircle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{expenses.filter(ex => ex.status === 'Cancelada').length}</div>
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
          <Tabs defaultValue="all" onValueChange={(value) => setActiveTab(value as ExpenseFormInput["status"] | "all")}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 mb-4">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="Borrador">Borrador</TabsTrigger>
              <TabsTrigger value="Confirmada">Confirmada</TabsTrigger>
              <TabsTrigger value="Pagado">Pagado</TabsTrigger>
              <TabsTrigger value="Cancelada">Cancelada</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab}>
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
                    {filteredExpenses.map((expense) => (
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
                              <Button variant="ghost" size="icon" disabled={expense.status === 'Pagado' || expense.status === 'Cancelada'}>
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(expense as ExpenseFormInput & { id: string })} disabled={expense.status === 'Pagado' || expense.status === 'Cancelada'}>
                                <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                   <DropdownMenuItem onSelect={(e) => {e.preventDefault(); setDeletingExpenseId(expense.id!)}} className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive" disabled={!['Borrador', 'Cancelada'].includes(expense.status)}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente el gasto: "{expenses.find(ex => ex.id === deletingExpenseId)?.description}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDeletingExpenseId(null)}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredExpenses.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          No hay gastos en esta categoría.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Mostrando {filteredExpenses.length} de {expenses.length} gastos.</p>
        </CardFooter>
      </Card>

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

