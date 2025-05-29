
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { addSaleOrder, updateSaleOrder, deleteSaleOrder, getSaleOrders, getSaleOrderById, type SaleOrderWithDetails, type SaleOrderActionResponse } from "@/app/actions/sales.actions";
import { getInventoryItems, type InventoryItemFormInput as AppInventoryItem } from "@/app/actions/inventory.actions";
import { getContacts, type ContactFormInput as AppContact } from "@/app/actions/contacts.actions";
import { useToast } from "@/hooks/use-toast";

const getStatusBadge = (status: SaleOrderFormInput["status"]) => {
  switch (status) {
    case "Borrador": return <Badge variant="outline" className="border-yellow-500/70 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"><Hourglass className="mr-1 h-3 w-3" />Borrador</Badge>;
    case "Confirmada": return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Confirmada</Badge>;
    case "Enviada": return <Badge variant="outline" className="border-purple-500/70 bg-purple-500/10 text-purple-700 dark:text-purple-400"><Store className="mr-1 h-3 w-3" />Enviada</Badge>;
    case "Entregada": return <Badge variant="outline" className="border-teal-500/70 bg-teal-500/10 text-teal-700 dark:text-teal-400"><PackageCheck className="mr-1 h-3 w-3" />Entregada</Badge>;
    case "Pagada": return <Badge variant="default" className="bg-green-600/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-600/30"><CreditCard className="mr-1 h-3 w-3" />Pagada</Badge>;
    case "Cancelada": return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Cancelada</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

interface AppSaleOrder extends Omit<SaleOrderFormInput, 'items' | 'customerId'> {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  customerId: string;
  customerName?: string;
  description: string;
  items: (SaleOrderItemFormInput & {unitPrice: number})[];
}

function SaleOrderForm({ saleOrder, inventoryItems, clientContacts, onFormSubmit, closeDialog }: { saleOrder?: AppSaleOrder, inventoryItems: (AppInventoryItem & {id:string})[], clientContacts: (AppContact & { id: string})[], onFormSubmit: (data: SaleOrderFormInput) => Promise<SaleOrderActionResponse>, closeDialog: () => void }) {
  const { register, handleSubmit, control, watch, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<SaleOrderFormInput>({
    resolver: zodResolver(SaleOrderSchema),
    defaultValues: saleOrder ?
      {...saleOrder, customerId: saleOrder.customerId.toString(), description: saleOrder.description || '' } :
      {
        customerId: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'Borrador',
        items: [{ inventoryItemId: '', quantity: 1, unitPrice: 0 }],
      },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const currentStatus = watch("status");
  const orderIsPaid = saleOrder?.status === 'Pagado';
  const orderIsDeliveredOrBeyond = saleOrder && ['Entregada', 'Pagada'].includes(saleOrder.status);
  const isFormEditable = !saleOrder || saleOrder.status === 'Borrador';


  const handleInventoryItemChange = (itemIndex: number, itemId: string) => {
    const selectedItem = inventoryItems.find(invItem => invItem.id === itemId);
    if (selectedItem) {
      setValue(`items.${itemIndex}.unitPrice`, selectedItem.salePrice ?? selectedItem.unitPrice);
    }
  };

  const totalOrderAmount = watchedItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return sum + (quantity * unitPrice);
  }, 0);

  const processFormSubmit = async (data: SaleOrderFormInput) => {
    clearErrors("itemErrors" as any);
    const response = await onFormSubmit(data);
    if (!response.success && response.itemErrors) {
        response.itemErrors.forEach(err => {
            setError(`items.${err.index}.${err.field}` as any, { type: 'manual', message: err.message });
        });
    }
  };


  return (
    <form onSubmit={handleSubmit(processFormSubmit)} className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="customerId">Cliente</Label>
          <Controller
            name="customerId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isFormEditable || orderIsPaid}>
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
          <Label htmlFor="date">Fecha de Venta</Label>
          <Input id="date" type="date" {...register("date")} disabled={!isFormEditable || orderIsPaid} />
          {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
        </div>
      </div>
       <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" {...register("description")} placeholder="Ej. Venta de servicios de consultoría" disabled={!isFormEditable || orderIsPaid}/>
        {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
      </div>
      <div>
        <Label htmlFor="status">Estado</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={orderIsPaid}>
              <SelectTrigger id="status"><SelectValue placeholder="Seleccionar estado..." /></SelectTrigger>
              <SelectContent>
                 {(currentStatus === 'Borrador' || !saleOrder) && <SelectItem value="Borrador">Borrador</SelectItem>}
                
                {(!orderIsDeliveredOrBeyond && currentStatus !== 'Cancelada') && <SelectItem value="Confirmada">Confirmada</SelectItem>}

                {(!orderIsDeliveredOrBeyond && currentStatus !== 'Cancelada' && currentStatus !== 'Borrador') && <SelectItem value="Enviada">Enviada</SelectItem>}

                {(!orderIsDeliveredOrBeyond && currentStatus !== 'Cancelada' && currentStatus !== 'Borrador' && currentStatus !== 'Confirmada') && <SelectItem value="Entregada">Entregada</SelectItem>}
                
                {!orderIsPaid && <SelectItem value="Cancelada">Cancelada</SelectItem>}
                
                {orderIsPaid && <SelectItem value="Pagado" disabled>Pagado</SelectItem>}
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
                    disabled={!isFormEditable || orderIsPaid}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar artículo..." /></SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map(item => (
                        <SelectItem key={item.id} value={item.id!}>{item.name} ({item.sku}) - Disp: {item.currentStock} - P.Venta: €{(item.salePrice ?? item.unitPrice).toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.items?.[index]?.inventoryItemId && <p className="text-sm text-destructive mt-1">{errors.items[index]?.inventoryItemId?.message}</p>}
              {errors.items?.[index]?.quantity && errors.items[index]?.quantity?.type === 'manual' && <p className="text-sm text-destructive mt-1">{errors.items[index]?.quantity?.message}</p>}
            </div>
            <div className="col-span-2">
              <Label htmlFor={`items.${index}.quantity`} className="text-xs">Cantidad</Label>
              <Input id={`items.${index}.quantity`} type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true, min: 1 })} disabled={!isFormEditable || orderIsPaid} />
              {errors.items?.[index]?.quantity && errors.items[index]?.quantity?.type !== 'manual' && <p className="text-sm text-destructive mt-1">{errors.items[index]?.quantity?.message}</p>}
            </div>
            <div className="col-span-3">
              <Label htmlFor={`items.${index}.unitPrice`} className="text-xs">Precio Unit. (€)</Label>
              <Input id={`items.${index}.unitPrice`} type="number" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} disabled={!isFormEditable || orderIsPaid}/>
              {errors.items?.[index]?.unitPrice && <p className="text-sm text-destructive mt-1">{errors.items[index]?.unitPrice?.message}</p>}
            </div>
            <div className="col-span-2 flex items-end">
              {(isFormEditable && !orderIsPaid) && fields.length > 1 && (
               <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-destructive hover:text-destructive">
                <Trash className="h-4 w-4" />
              </Button>
              )}
            </div>
          </div>
        ))}
        {(isFormEditable && !orderIsPaid) && (
            <Button type="button" variant="outline" size="sm" onClick={() => append({ inventoryItemId: '', quantity: 1, unitPrice: 0 })}>
            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Artículo
            </Button>
        )}
         {errors.items && typeof errors.items === 'string' && <p className="text-sm text-destructive mt-1">{errors.items}</p>}
         {errors.itemErrors && errors.itemErrors.length > 0 && !errors.items && 
            <p className="text-sm text-destructive mt-1">Corrija los errores en los artículos.</p>}
      </div>

      <div className="text-right font-semibold text-lg">
        Monto Total: €{totalOrderAmount.toFixed(2)}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting || orderIsPaid}>
          {isSubmitting ? (saleOrder ? "Guardando..." : "Creando...") : (saleOrder ? "Guardar Cambios" : "Crear Venta")}
        </Button>
      </DialogFooter>
    </form>
  );
}


export default function SalesPage() {
  const [salesOrders, setSalesOrders] = useState<AppSaleOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<(AppInventoryItem & { id: string})[]>([]);
  const [clientContacts, setClientContacts] = useState<(AppContact & { id: string})[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingSaleOrder, setEditingSaleOrder] = useState<AppSaleOrder | undefined>(undefined);
  const [deletingSaleOrderId, setDeletingSaleOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const refreshData = async () => {
    const [serverSOs, serverInvItems, serverClientContacts] = await Promise.all([
        getSaleOrders(),
        getInventoryItems(),
        getContacts({ type: 'Cliente' })
    ]);
    setSalesOrders(serverSOs.map(so => ({ ...so, description: so.description || '', items: [] })));
    setInventoryItems(serverInvItems);
    setClientContacts(serverClientContacts);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleAddSubmit = async (data: SaleOrderFormInput): Promise<SaleOrderActionResponse> => {
    const response = await addSaleOrder(data);
    if (response.success && response.saleOrder) {
      toast({ title: "Éxito", description: response.message });
      refreshData();
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir la orden de venta.", errors: response.errors });
    }
    return response;
  };

  const handleEditSubmit = async (data: SaleOrderFormInput): Promise<SaleOrderActionResponse> => {
    if (!editingSaleOrder?.id) return {success: false, message: "ID de orden no encontrado"};
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
    return response;
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSaleOrderId) return;
    const orderToDelete = salesOrders.find(so => so.id === deletingSaleOrderId);
    if (orderToDelete && !['Borrador', 'Cancelada'].includes(orderToDelete.status)) {
        toast({ variant: "destructive", title: "Error", description: `No se puede eliminar una orden en estado '${orderToDelete.status}'.` });
        setDeletingSaleOrderId(null);
        return;
    }
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
        const itemsWithPrice = orderToEdit.items.map(item => ({
            ...item,
            unitPrice: item.unitPrice
        }));
        setEditingSaleOrder({...orderToEdit, description: orderToEdit.description || '', items: itemsWithPrice } as AppSaleOrder);
        setIsEditDialogOpen(true);
    } else {
        toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la orden para editar."});
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
              <Input placeholder="Buscar Ventas (N°, Cliente, Descripción)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
          </div>

          <Tabs defaultValue="all" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 mb-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="Borrador">Borrador</TabsTrigger>
              <TabsTrigger value="Confirmada">Confirmada</TabsTrigger>
              <TabsTrigger value="Enviada">Enviada</TabsTrigger>
              <TabsTrigger value="Entregada">Entregada</TabsTrigger>
              <TabsTrigger value="Pagada">Pagada</TabsTrigger>
              <TabsTrigger value="Cancelada">Cancelada</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Factura</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
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
                           <TableCell className="max-w-sm truncate">{sale.description || "N/A"}</TableCell>
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
                                <DropdownMenuItem onClick={() => openEditDialog(sale.id!)} disabled={sale.status === 'Pagado'}>
                                  <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                     <DropdownMenuItem onSelect={(e) => {e.preventDefault(); setDeletingSaleOrderId(sale.id!)}} className="text-destructive dark:text-destructive-foreground focus:text-destructive" disabled={!['Borrador', 'Cancelada'].includes(sale.status)}>
                                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>Se eliminará la venta {salesOrders.find(s=>s.id === deletingSaleOrderId)?.invoiceNumber}. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingSaleOrderId(null)}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSalesOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
        </CardFooter>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingSaleOrder(undefined);}}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Venta / Factura: {editingSaleOrder?.invoiceNumber}</DialogTitle>
            <DialogDescription>Actualiza los detalles de la venta. La edición de artículos solo es posible si la venta está en estado "Borrador".</DialogDescription>
          </DialogHeader>
          {editingSaleOrder && <SaleOrderForm saleOrder={editingSaleOrder} inventoryItems={inventoryItems} clientContacts={clientContacts} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingSaleOrder(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

    