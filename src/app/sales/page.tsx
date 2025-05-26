
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Store, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, FileText, CreditCard, CheckCircle, XCircle, Hourglass, PackageCheck } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SaleOrderSchema, type SaleOrderFormInput, addSaleOrder, updateSaleOrder, deleteSaleOrder, getSaleOrders } from "@/app/actions/sales.actions";
import { useToast } from "@/hooks/use-toast";

const initialSalesOrdersData: SaleOrderFormInput[] = [
  { id: "1", invoiceNumber: "INV-2024-001", customer: "Cliente X", date: "2024-07-10", totalAmount: 750.50, status: "Pagada" },
  { id: "2", invoiceNumber: "INV-2024-002", customer: "Cliente Y", date: "2024-07-12", totalAmount: 1200.00, status: "Entregada" },
  { id: "3", invoiceNumber: "INV-2024-003", customer: "Patrón Z", date: "2024-07-15", totalAmount: 350.25, status: "Enviada" },
  { id: "4", invoiceNumber: "INV-2024-004", customer: "Comprador A", date: "2024-07-18", totalAmount: 1800.70, status: "Confirmada" },
  { id: "5", invoiceNumber: "INV-2024-005", customer: "Comprador B", date: "2024-07-20", totalAmount: 95.00, status: "Borrador" },
  { id: "6", invoiceNumber: "INV-2024-006", customer: "Cliente C", date: "2024-07-21", totalAmount: 420.00, status: "Cancelada" },
];

const getStatusBadge = (status: SaleOrderFormInput["status"]) => {
  switch (status) {
    case "Borrador":
      return <Badge variant="outline" className="border-yellow-500/70 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"><Hourglass className="mr-1 h-3 w-3" />Borrador</Badge>;
    case "Confirmada":
      return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Confirmada</Badge>;
    case "Enviada":
      return <Badge variant="outline" className="border-purple-500/70 bg-purple-500/10 text-purple-700 dark:text-purple-400"><Store className="mr-1 h-3 w-3" />Enviada</Badge>;
    case "Entregada":
      return <Badge variant="outline" className="border-teal-500/70 bg-teal-500/10 text-teal-700 dark:text-teal-400"><PackageCheck className="mr-1 h-3 w-3" />Entregada</Badge>;
    case "Pagada":
      return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30"><CreditCard className="mr-1 h-3 w-3" />Pagada</Badge>;
    case "Cancelada":
      return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Cancelada</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

function SaleOrderForm({ saleOrder, onFormSubmit, closeDialog }: { saleOrder?: SaleOrderFormInput, onFormSubmit: (data: SaleOrderFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<SaleOrderFormInput>({
    resolver: zodResolver(SaleOrderSchema),
    defaultValues: saleOrder || {
      invoiceNumber: '',
      customer: '',
      date: new Date().toISOString().split('T')[0],
      totalAmount: 0,
      status: 'Borrador',
    },
  });

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="invoiceNumber">Número de Factura</Label>
        <Input id="invoiceNumber" {...register("invoiceNumber")} />
        {errors.invoiceNumber && <p className="text-sm text-destructive mt-1">{errors.invoiceNumber.message}</p>}
      </div>
      <div>
        <Label htmlFor="customer">Cliente</Label>
        <Input id="customer" {...register("customer")} />
        {errors.customer && <p className="text-sm text-destructive mt-1">{errors.customer.message}</p>}
      </div>
      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
      </div>
      <div>
        <Label htmlFor="totalAmount">Monto Total (€)</Label>
        <Input id="totalAmount" type="number" step="0.01" {...register("totalAmount")} />
        {errors.totalAmount && <p className="text-sm text-destructive mt-1">{errors.totalAmount.message}</p>}
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
                <SelectItem value="Borrador">Borrador</SelectItem>
                <SelectItem value="Confirmada">Confirmada</SelectItem>
                <SelectItem value="Enviada">Enviada</SelectItem>
                <SelectItem value="Entregada">Entregada</SelectItem>
                <SelectItem value="Pagada">Pagada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && <p className="text-sm text-destructive mt-1">{errors.status.message}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (saleOrder ? "Guardando..." : "Añadiendo...") : (saleOrder ? "Guardar Cambios" : "Añadir Venta")}
        </Button>
      </DialogFooter>
    </form>
  );
}


export default function SalesPage() {
  const [salesOrders, setSalesOrders] = useState<SaleOrderFormInput[]>(initialSalesOrdersData);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSaleOrder, setEditingSaleOrder] = useState<SaleOrderFormInput | undefined>(undefined);
  const [deletingSaleOrderId, setDeletingSaleOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  // TODO: Cargar datos del servidor
  // useEffect(() => {
  //   async function loadSalesOrders() {
  //     const serverSOs = await getSaleOrders();
  //     setSalesOrders(serverSOs);
  //   }
  //   loadSalesOrders();
  // }, []);

  const handleAddSubmit = async (data: SaleOrderFormInput) => {
    const response = await addSaleOrder(data);
    if (response.success && response.saleOrder) {
      toast({ title: "Éxito", description: response.message });
      // setSalesOrders(prev => [...prev, response.saleOrder!]);
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir la orden de venta." });
    }
  };

  const handleEditSubmit = async (data: SaleOrderFormInput) => {
    if (!editingSaleOrder?.id) return;
    const response = await updateSaleOrder({ ...data, id: editingSaleOrder.id });
    if (response.success && response.saleOrder) {
      toast({ title: "Éxito", description: response.message });
      // setSalesOrders(prev => prev.map(so => so.id === response.saleOrder?.id ? response.saleOrder : so));
      setIsEditDialogOpen(false);
      setEditingSaleOrder(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar la orden de venta." });
    }
  };

  const handleDelete = async () => {
    if (!deletingSaleOrderId) return;
    const response = await deleteSaleOrder(deletingSaleOrderId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      // setSalesOrders(prev => prev.filter(so => so.id !== deletingSaleOrderId));
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar la orden de venta." });
    }
    setDeletingSaleOrderId(null);
  };
  
  const openEditDialog = (so: SaleOrderFormInput) => {
    setEditingSaleOrder(so);
    setIsEditDialogOpen(true);
  };

  const handleStatusUpdate = async (soId: string, newStatus: SaleOrderFormInput["status"]) => {
    const soToUpdate = salesOrders.find(so => so.id === soId);
    if (!soToUpdate) return;
    const response = await updateSaleOrder({ ...soToUpdate, status: newStatus });
    if (response.success) {
      toast({ title: "Éxito", description: `Venta ${soToUpdate.invoiceNumber} actualizada a ${newStatus}.` });
      // Actualizar UI o confiar en revalidatePath
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar el estado." });
    }
  };

  const filteredSalesOrders = salesOrders.filter(so => activeTab === "all" || so.status.toLowerCase() === activeTab.toLowerCase());


  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Store className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-3xl font-bold">Gestión de Ventas</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Supervisa las órdenes de venta y facturas, desde la creación hasta el pago.
                </CardDescription>
              </div>
            </div>
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-5 w-5" /> Nueva Venta / Factura
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Nueva Venta / Factura</DialogTitle>
                  <DialogDescription>Completa los detalles para crear una nueva venta.</DialogDescription>
                </DialogHeader>
                <SaleOrderForm onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar ventas (ej., N° factura, cliente)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
          </div>

          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 mb-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="draft">Borrador</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmadas</TabsTrigger>
              <TabsTrigger value="shipped">Enviadas</TabsTrigger>
              <TabsTrigger value="delivered">Entregadas</TabsTrigger>
              <TabsTrigger value="paid">Pagadas</TabsTrigger>
              <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSalesOrders.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                          <TableCell>{sale.customer}</TableCell>
                          <TableCell>{sale.date}</TableCell>
                          <TableCell className="text-right">€{sale.totalAmount.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(sale.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(sale)}>
                                  <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="mr-2 h-4 w-4" /> Ver PDF
                                </DropdownMenuItem>
                                {sale.status === "Borrador" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Confirmada")}><CheckCircle className="mr-2 h-4 w-4"/> Confirmar Venta</DropdownMenuItem>}
                                {sale.status === "Confirmada" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Enviada")}><Store className="mr-2 h-4 w-4" /> Marcar como Enviada</DropdownMenuItem>}
                                {sale.status === "Enviada" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Entregada")}><PackageCheck className="mr-2 h-4 w-4" /> Marcar como Entregada</DropdownMenuItem>}
                                {(sale.status === "Entregada" || sale.status === "Confirmada" || sale.status === "Enviada") && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Pagada")}><CreditCard className="mr-2 h-4 w-4" /> Marcar como Pagada</DropdownMenuItem>}
                                {sale.status !== "Cancelada" && sale.status !== "Pagada" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Cancelada")} className="text-amber-600 focus:text-amber-700 dark:text-amber-500 dark:focus:text-amber-400"><XCircle className="mr-2 h-4 w-4"/> Cancelar Venta</DropdownMenuItem>}
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
                                        Esta acción no se puede deshacer. Se eliminará permanentemente la venta {sale.invoiceNumber}.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel onClick={() => setDeletingSaleOrderId(null)}>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => { setDeletingSaleOrderId(sale.id!); handleDelete(); }} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSalesOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No hay órdenes de venta en esta categoría.
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
           <p className="text-sm text-muted-foreground">Mostrando {filteredSalesOrders.length} de {salesOrders.length} órdenes de venta.</p>
          {/* Pagination placeholder */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          </div>
        </CardFooter>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingSaleOrder(undefined);}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Venta / Factura</DialogTitle>
            <DialogDescription>Actualiza los detalles de la venta.</DialogDescription>
          </DialogHeader>
          {editingSaleOrder && <SaleOrderForm saleOrder={editingSaleOrder} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingSaleOrder(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
