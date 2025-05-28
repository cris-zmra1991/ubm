
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Store, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, FileText, CreditCard, CheckCircle, XCircle, Hourglass, PackageCheck, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SaleOrderSchema } from "@/app/schemas/sales.schemas";
import type { SaleOrderFormInput, SaleOrderItemFormInput } from "@/app/schemas/sales.schemas";
import { addSaleOrder, updateSaleOrder, deleteSaleOrder, getSaleOrders, type SaleOrderWithDetails } from "@/app/actions/sales.actions";
import { getInventoryItems, type InventoryItemFormInput } from "@/app/actions/inventory.actions";
import { getContacts, type ContactFormInput } from "@/app/actions/contacts.actions";
import { useToast } from "@/hooks/use-toast";

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

interface AppSaleOrder extends Omit<SaleOrderFormInput, 'items' | 'customerId'> {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  customerId: string;
  customerName?: string;
  items: SaleOrderItemFormInput[];
}

function SaleOrderForm({ saleOrder, inventoryItems, clientContacts, onFormSubmit, closeDialog }: { saleOrder?: AppSaleOrder, inventoryItems: InventoryItemFormInput[], clientContacts: (ContactFormInput & { id: string})[], onFormSubmit: (data: SaleOrderFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<SaleOrderFormInput>({
    resolver: zodResolver(SaleOrderSchema),
    defaultValues: saleOrder ?
      {...saleOrder, customerId: saleOrder.customerId.toString() } :
      {
        customerId: '',
        date: new Date().toISOString().split('T')[0],
        status: 'Borrador',
        items: [{ inventoryItemId: '', quantity: 1, unitPrice: 0 }],
      },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");

  const handleInventoryItemChange = (itemIndex: number, itemId: string) => {
    const selectedItem = inventoryItems.find(invItem => invItem.id === itemId);
    if (selectedItem) {
      setValue(`items.${itemIndex}.unitPrice`, selectedItem.unitPrice);
    }
  };
  
  const totalOrderAmount = watchedItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return sum + (quantity * unitPrice);
  }, 0);

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="customerId">Cliente</Label>
        <Controller
          name="customerId"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="customerId"><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
              <SelectContent>
                {clientContacts.map(contact => (
                  <SelectItem key={contact.id} value={contact.id.toString()}>{contact.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.customerId && <p className="text-sm text-destructive mt-1">{errors.customerId.message}</p>}
      </div>
      <div>
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" type="date" {...register("date")} />
        {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
      </div>
      <div>
        <Label htmlFor="status">Estado</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="status"><SelectValue placeholder="Seleccionar estado..." /></SelectTrigger>
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

      <div className="space-y-3">
        <Label className="text-md font-medium">Artículos de la Venta</Label>
        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-2 p-3 border rounded-md">
            <div className="col-span-5">
              <Label htmlFor={`items.${index}.inventoryItemId`} className="text-xs">Artículo</Label>
              <Controller
                name={`items.${index}.inventoryItemId`}
                control={control}
                render={({ field: selectField }) => (
                  <Select
                    onValueChange={(value) => {
                      selectField.onChange(value);
                      handleInventoryItemChange(index, value);
                    }}
                    defaultValue={selectField.value}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar artículo..." /></SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map(item => (
                        <SelectItem key={item.id} value={item.id!}>{item.name} ({item.sku}) - Stock: {item.currentStock}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.items?.[index]?.inventoryItemId && <p className="text-sm text-destructive mt-1">{errors.items[index]?.inventoryItemId?.message}</p>}
               {errors.itemErrors?.find(e => e.index === index && e.field === 'quantity') && <p className="text-sm text-destructive mt-1">{errors.itemErrors.find(e => e.index === index && e.field === 'quantity')?.message}</p>}
            </div>
            <div className="col-span-2">
              <Label htmlFor={`items.${index}.quantity`} className="text-xs">Cantidad</Label>
              <Input id={`items.${index}.quantity`} type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
              {errors.items?.[index]?.quantity && <p className="text-sm text-destructive mt-1">{errors.items[index]?.quantity?.message}</p>}
            </div>
            <div className="col-span-3">
              <Label htmlFor={`items.${index}.unitPrice`} className="text-xs">Precio Unit. (€)</Label>
              <Input id={`items.${index}.unitPrice`} type="number" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} />
              {errors.items?.[index]?.unitPrice && <p className="text-sm text-destructive mt-1">{errors.items[index]?.unitPrice?.message}</p>}
            </div>
            <div className="col-span-2 flex items-end">
               <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-destructive hover:text-destructive" disabled={fields.length <= 1}>
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => append({ inventoryItemId: '', quantity: 1, unitPrice: 0 })}>
          <PlusCircle className="mr-2 h-4 w-4" /> Añadir Artículo
        </Button>
         {errors.items && typeof errors.items === 'object' && 'message' in errors.items && <p className="text-sm text-destructive mt-1">{errors.items.message as string}</p>}
         {errors.items && Array.isArray(errors.items) && errors.items.length > 0 && !errors.items[0] && <p className="text-sm text-destructive mt-1">Error general en los artículos. Revisa las cantidades y el stock.</p>}
      </div>
      
      <div className="text-right font-semibold text-lg">
        Monto Total: €{totalOrderAmount.toFixed(2)}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (saleOrder ? "Guardando..." : "Creando...") : (saleOrder ? "Guardar Cambios" : "Crear Venta")}
        </Button>
      </DialogFooter>
    </form>
  );
}


export default function SalesPage() {
  const [salesOrders, setSalesOrders] = useState<AppSaleOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemFormInput[]>([]);
  const [clientContacts, setClientContacts] = useState<(ContactFormInput & { id: string})[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSaleOrder, setEditingSaleOrder] = useState<AppSaleOrder | undefined>(undefined);
  const [deletingSaleOrderId, setDeletingSaleOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const refreshData = async () => {
    // TODO: Cargar datos del servidor
    const [serverSOs, serverInvItems, serverClientContacts] = await Promise.all([
        getSaleOrders(),
        getInventoryItems(),
        getContacts({ type: 'Cliente' })
    ]);
    setSalesOrders(serverSOs.map(so => ({ ...so, items: [] })));
    setInventoryItems(serverInvItems);
    setClientContacts(serverClientContacts);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleAddSubmit = async (data: SaleOrderFormInput) => {
    const response = await addSaleOrder(data);
    if (response.success && response.saleOrder) {
      toast({ title: "Éxito", description: response.message });
      refreshData();
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir la orden de venta.", errors: response.errors });
    }
  };

  const handleEditSubmit = async (data: SaleOrderFormInput) => {
    if (!editingSaleOrder?.id) return;
    const dataForUpdate = { ...data, id: editingSaleOrder.id, invoiceNumber: editingSaleOrder.invoiceNumber, totalAmount: editingSaleOrder.totalAmount };
    const response = await updateSaleOrder(dataForUpdate);
    if (response.success && response.saleOrder) {
      toast({ title: "Éxito", description: response.message });
      refreshData();
      setIsEditDialogOpen(false);
      setEditingSaleOrder(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar la orden de venta.", errors: response.errors });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSaleOrderId) return;
    const response = await deleteSaleOrder(deletingSaleOrderId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      refreshData();
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar la orden de venta." });
    }
    setDeletingSaleOrderId(null);
  };

  const openEditDialog = async (soId: string) => {
    const orderToEdit = await getSaleOrderById(soId);
     if (orderToEdit) {
        setEditingSaleOrder(orderToEdit as AppSaleOrder); // Cast as AppSaleOrder
        setIsEditDialogOpen(true);
    } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la orden para editar."});
    }
  };

  const handleStatusUpdate = async (soId: string, newStatus: SaleOrderFormInput["status"]) => {
    const soToUpdate = salesOrders.find(so => so.id === soId);
    if (!soToUpdate) return;
    
    const dataForStatusUpdate: SaleOrderFormInput & {id:string} = {
        id: soToUpdate.id,
        customerId: soToUpdate.customerId,
        date: soToUpdate.date,
        status: newStatus,
        items: soToUpdate.items, // Esto podría estar vacío si no se cargan los items en la lista principal
    };
    const response = await updateSaleOrder(dataForStatusUpdate);
    if (response.success) {
      toast({ title: "Éxito", description: `Venta ${soToUpdate.invoiceNumber} actualizada a ${newStatus}.` });
      refreshData();
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
                  Supervisa las órdenes de venta y facturas.
                </CardDescription>
              </div>
            </div>
             <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-5 w-5" /> Nueva Venta / Factura
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nueva Venta / Factura</DialogTitle>
                  <DialogDescription>Completa los detalles para crear una nueva venta.</DialogDescription>
                </DialogHeader>
                <SaleOrderForm inventoryItems={inventoryItems} clientContacts={clientContacts} onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar ventas..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
          </div>

          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 mb-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="Borrador">Borrador</TabsTrigger>
              <TabsTrigger value="Confirmada">Confirmadas</TabsTrigger>
              <TabsTrigger value="Enviada">Enviadas</TabsTrigger>
              <TabsTrigger value="Entregada">Entregadas</TabsTrigger>
              <TabsTrigger value="Pagada">Pagadas</TabsTrigger>
              <TabsTrigger value="Cancelada">Canceladas</TabsTrigger>
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
                          <TableCell className="font-medium">{sale.invoiceNumber || 'N/A'}</TableCell>
                          <TableCell>{sale.customerName || sale.customerId}</TableCell>
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
                                <DropdownMenuItem onClick={() => openEditDialog(sale.id!)}>
                                  <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                                </DropdownMenuItem>
                                {sale.status === "Borrador" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Confirmada")}><CheckCircle className="mr-2 h-4 w-4"/> Confirmar Venta</DropdownMenuItem>}
                                {sale.status === "Confirmada" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Enviada")}><Store className="mr-2 h-4 w-4" /> Marcar como Enviada</DropdownMenuItem>}
                                {sale.status === "Enviada" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Entregada")}><PackageCheck className="mr-2 h-4 w-4" /> Marcar como Entregada</DropdownMenuItem>}
                                {(sale.status === "Confirmada" || sale.status === "Enviada" || sale.status === "Entregada") && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Pagada")}><CreditCard className="mr-2 h-4 w-4" /> Marcar como Pagada</DropdownMenuItem>}
                                {sale.status !== "Cancelada" && sale.status !== "Pagada" && <DropdownMenuItem onClick={() => handleStatusUpdate(sale.id!, "Cancelada")} className="text-amber-600 focus:text-amber-700 dark:text-amber-500 dark:focus:text-amber-400"><XCircle className="mr-2 h-4 w-4"/> Cancelar Venta</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                     <DropdownMenuItem onSelect={(e) => {e.preventDefault(); setDeletingSaleOrderId(sale.id!)}} className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente la venta {salesOrders.find(s=>s.id === deletingSaleOrderId)?.invoiceNumber}.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel onClick={() => setDeletingSaleOrderId(null)}>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingSaleOrder(undefined);}}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Venta / Factura: {editingSaleOrder?.invoiceNumber}</DialogTitle>
            <DialogDescription>Actualiza los detalles de la venta. La edición de artículos individuales no está disponible aquí.</DialogDescription>
          </DialogHeader>
          {editingSaleOrder && <SaleOrderForm saleOrder={editingSaleOrder} inventoryItems={inventoryItems} clientContacts={clientContacts} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingSaleOrder(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    