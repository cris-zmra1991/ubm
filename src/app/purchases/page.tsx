
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShoppingCart, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, FileText, Truck, CheckCircle, XCircle, Hourglass } from "lucide-react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PurchaseOrderSchema, type PurchaseOrderFormInput, addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, getPurchaseOrders } from "@/app/actions/purchases.actions";
import { useToast } from "@/hooks/use-toast";

// Datos iniciales (se reemplazarán con datos del servidor si es posible)
const initialPurchaseOrdersData: PurchaseOrderFormInput[] = [
  { id: "1", poNumber: "PO-2024-001", vendor: "Proveedor Alpha", date: "2024-07-15", totalAmount: 1250.75, status: "Recibida" },
  { id: "2", poNumber: "PO-2024-002", vendor: "Proveedor Beta", date: "2024-07-18", totalAmount: 875.00, status: "Enviada" },
  { id: "3", poNumber: "PO-2024-003", vendor: "Vendedor Gamma", date: "2024-07-20", totalAmount: 2300.50, status: "Confirmada" },
  { id: "4", poNumber: "PO-2024-004", vendor: "Proveedor Delta", date: "2024-07-22", totalAmount: 550.20, status: "Borrador" },
  { id: "5", poNumber: "PO-2024-005", vendor: "Proveedor Epsilon", date: "2024-07-23", totalAmount: 150.00, status: "Cancelada" },
];

const getStatusBadge = (status: PurchaseOrderFormInput["status"]) => {
  switch (status) {
    case "Borrador":
      return <Badge variant="outline" className="border-yellow-500/70 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"><Hourglass className="mr-1 h-3 w-3" />Borrador</Badge>;
    case "Confirmada":
      return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Confirmada</Badge>;
    case "Enviada":
      return <Badge variant="outline" className="border-purple-500/70 bg-purple-500/10 text-purple-700 dark:text-purple-400"><Truck className="mr-1 h-3 w-3" />Enviada</Badge>;
    case "Recibida":
      return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30"><CheckCircle className="mr-1 h-3 w-3" />Recibida</Badge>;
    case "Cancelada":
      return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Cancelada</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

function PurchaseOrderForm({ purchaseOrder, onFormSubmit, closeDialog }: { purchaseOrder?: PurchaseOrderFormInput, onFormSubmit: (data: PurchaseOrderFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<PurchaseOrderFormInput>({
    resolver: zodResolver(PurchaseOrderSchema),
    defaultValues: purchaseOrder || {
      poNumber: '',
      vendor: '',
      date: new Date().toISOString().split('T')[0], // Fecha actual por defecto
      totalAmount: 0,
      status: 'Borrador',
    },
  });

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="poNumber">Número de OC</Label>
        <Input id="poNumber" {...register("poNumber")} />
        {errors.poNumber && <p className="text-sm text-destructive mt-1">{errors.poNumber.message}</p>}
      </div>
      <div>
        <Label htmlFor="vendor">Proveedor</Label>
        <Input id="vendor" {...register("vendor")} />
        {errors.vendor && <p className="text-sm text-destructive mt-1">{errors.vendor.message}</p>}
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
                <SelectItem value="Recibida">Recibida</SelectItem>
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
          {isSubmitting ? (purchaseOrder ? "Guardando..." : "Añadiendo...") : (purchaseOrder ? "Guardar Cambios" : "Añadir Orden")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function PurchasesPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderFormInput[]>(initialPurchaseOrdersData);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<PurchaseOrderFormInput | undefined>(undefined);
  const [deletingPurchaseOrderId, setDeletingPurchaseOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  // TODO: En un escenario real, aquí se haría un fetch a /api/purchase-orders o se recibirían props de un Server Component
  // useEffect(() => {
  //   async function loadPurchaseOrders() {
  //     const serverPOs = await getPurchaseOrders(); // Llamar a la Server Action
  //     setPurchaseOrders(serverPOs);
  //   }
  //   loadPurchaseOrders();
  // }, []);
  // Para que la UI se actualice tras una acción, se debería re-fetchear o Next.js revalidaría la ruta.

  const handleAddSubmit = async (data: PurchaseOrderFormInput) => {
    const response = await addPurchaseOrder(data);
    if (response.success && response.purchaseOrder) {
      toast({ title: "Éxito", description: response.message });
      // Actualización optimista o re-fetch. Por ahora, se depende de revalidatePath.
      // setPurchaseOrders(prev => [...prev, response.purchaseOrder!]);
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir la orden de compra." });
    }
  };

  const handleEditSubmit = async (data: PurchaseOrderFormInput) => {
    if (!editingPurchaseOrder?.id) return;
    const response = await updatePurchaseOrder({ ...data, id: editingPurchaseOrder.id });
    if (response.success && response.purchaseOrder) {
      toast({ title: "Éxito", description: response.message });
      // setPurchaseOrders(prev => prev.map(po => po.id === response.purchaseOrder?.id ? response.purchaseOrder : po));
      setIsEditDialogOpen(false);
      setEditingPurchaseOrder(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar la orden de compra." });
    }
  };

  const handleDelete = async () => {
    if (!deletingPurchaseOrderId) return;
    const response = await deletePurchaseOrder(deletingPurchaseOrderId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      // setPurchaseOrders(prev => prev.filter(po => po.id !== deletingPurchaseOrderId));
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar la orden de compra." });
    }
    setDeletingPurchaseOrderId(null);
  };

  const openEditDialog = (po: PurchaseOrderFormInput) => {
    setEditingPurchaseOrder(po);
    setIsEditDialogOpen(true);
  };
  
  const handleStatusUpdate = async (poId: string, newStatus: PurchaseOrderFormInput["status"]) => {
    const poToUpdate = purchaseOrders.find(po => po.id === poId);
    if (!poToUpdate) return;
    const response = await updatePurchaseOrder({ ...poToUpdate, status: newStatus });
    if (response.success) {
      toast({ title: "Éxito", description: `Orden ${poToUpdate.poNumber} actualizada a ${newStatus}.` });
      // Actualizar UI o confiar en revalidatePath
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar el estado." });
    }
  };

  const filteredPurchaseOrders = purchaseOrders.filter(po => activeTab === "all" || po.status.toLowerCase() === activeTab.toLowerCase());

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-3xl font-bold">Gestión de Compras</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Realiza seguimiento y gestiona todas las órdenes de compra, desde el borrador hasta su finalización.
                </CardDescription>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-5 w-5" /> Nueva Orden de Compra
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Nueva Orden de Compra</DialogTitle>
                  <DialogDescription>Completa los detalles para crear una nueva OC.</DialogDescription>
                </DialogHeader>
                <PurchaseOrderForm onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar órdenes de compra (ej., N° OC, proveedor)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
          </div>

          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="draft">Borrador</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmadas</TabsTrigger>
              <TabsTrigger value="shipped">Enviadas</TabsTrigger>
              <TabsTrigger value="received">Recibidas</TabsTrigger>
              <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeTab}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° OC</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchaseOrders.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{po.vendor}</TableCell>
                          <TableCell>{po.date}</TableCell>
                          <TableCell className="text-right">€{po.totalAmount.toFixed(2)}</TableCell>
                          <TableCell>{getStatusBadge(po.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-5 w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditDialog(po)}>
                                  <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="mr-2 h-4 w-4" /> Ver PDF
                                </DropdownMenuItem>
                                {po.status === "Borrador" && <DropdownMenuItem onClick={() => handleStatusUpdate(po.id!, "Confirmada")}><CheckCircle className="mr-2 h-4 w-4" /> Confirmar Orden</DropdownMenuItem>}
                                {po.status === "Confirmada" && <DropdownMenuItem onClick={() => handleStatusUpdate(po.id!, "Enviada")}><Truck className="mr-2 h-4 w-4" /> Marcar como Enviada</DropdownMenuItem>}
                                {po.status === "Enviada" && <DropdownMenuItem onClick={() => handleStatusUpdate(po.id!, "Recibida")}><CheckCircle className="mr-2 h-4 w-4" /> Marcar como Recibida</DropdownMenuItem>}
                                {po.status !== "Cancelada" && po.status !== "Recibida" && <DropdownMenuItem onClick={() => handleStatusUpdate(po.id!, "Cancelada")} className="text-amber-600 focus:text-amber-700 dark:text-amber-500 dark:focus:text-amber-400"><XCircle className="mr-2 h-4 w-4" /> Cancelar Orden</DropdownMenuItem>}
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
                                        Esta acción no se puede deshacer. Se eliminará permanentemente la orden de compra {po.poNumber}.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel onClick={() => setDeletingPurchaseOrderId(null)}>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => { setDeletingPurchaseOrderId(po.id!); handleDelete(); }} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                       {filteredPurchaseOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No hay órdenes de compra en esta categoría.
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
          <p className="text-sm text-muted-foreground">Mostrando {filteredPurchaseOrders.length} de {purchaseOrders.length} órdenes de compra.</p>
          {/* Pagination placeholder */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          </div>
        </CardFooter>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingPurchaseOrder(undefined);}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Orden de Compra</DialogTitle>
            <DialogDescription>Actualiza los detalles de la OC.</DialogDescription>
          </DialogHeader>
          {editingPurchaseOrder && <PurchaseOrderForm purchaseOrder={editingPurchaseOrder} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingPurchaseOrder(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
