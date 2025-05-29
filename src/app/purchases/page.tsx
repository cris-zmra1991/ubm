
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
import { ShoppingCart, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, Hourglass, Truck, Trash, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PurchaseOrderSchema } from "@/app/schemas/purchases.schemas";
import type { PurchaseOrderFormInput, PurchaseOrderItemFormInput } from "@/app/schemas/purchases.schemas";
import { addPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, getPurchaseOrders, getPurchaseOrderById, type PurchaseOrderWithDetails } from "@/app/actions/purchases.actions";
import { getInventoryItems, type InventoryItemFormInput } from "@/app/actions/inventory.actions";
import { getContacts, type ContactFormInput } from "@/app/actions/contacts.actions";
import { useToast } from "@/hooks/use-toast";

const getStatusBadge = (status: PurchaseOrderFormInput["status"]) => {
  switch (status) {
    case "Borrador": return <Badge variant="outline" className="border-yellow-500/70 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"><Hourglass className="mr-1 h-3 w-3" />Borrador</Badge>;
    case "Confirmada": return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Confirmada</Badge>;
    case "Enviada": return <Badge variant="outline" className="border-purple-500/70 bg-purple-500/10 text-purple-700 dark:text-purple-400"><Truck className="mr-1 h-3 w-3" />Enviada</Badge>;
    case "Recibida": return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30"><CheckCircle className="mr-1 h-3 w-3" />Recibida</Badge>;
    case "Cancelada": return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Cancelada</Badge>;
    case "Pagado": return <Badge variant="default" className="bg-emerald-500/20 text-emerald-700 dark:bg-emerald-700/30 dark:text-emerald-300 border-emerald-500/30"><CheckCircle className="mr-1 h-3 w-3" />Pagado</Badge>;
    default: return <Badge variant="secondary">{status}</Badge>;
  }
};

interface AppPurchaseOrder extends Omit<PurchaseOrderFormInput, 'items' | 'vendorId'> {
  id: string;
  poNumber: string;
  totalAmount: number;
  vendorId: string;
  vendorName?: string;
  description: string;
  items: (PurchaseOrderItemFormInput & { itemName?: string, itemSku?: string })[];
}


function PurchaseOrderForm({ purchaseOrder, inventoryItems, vendorContacts, onFormSubmit, closeDialog }: { purchaseOrder?: AppPurchaseOrder, inventoryItems: (InventoryItemFormInput & {id:string})[], vendorContacts: (ContactFormInput & {id: string})[], onFormSubmit: (data: PurchaseOrderFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<PurchaseOrderFormInput>({
    resolver: zodResolver(PurchaseOrderSchema),
    defaultValues: purchaseOrder ?
      { ...purchaseOrder, vendorId: purchaseOrder.vendorId.toString(), items: purchaseOrder.items.map(item => ({...item, inventoryItemId: item.inventoryItemId.toString()})) } :
      {
        vendorId: '',
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

  const isFormEditable = !purchaseOrder || purchaseOrder.status === 'Borrador';
  const isStatusEditable = !purchaseOrder || purchaseOrder.status !== 'Pagado';


  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 max-h-[80vh] overflow-y-auto p-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="vendorId">Proveedor</Label>
          <Controller
            name="vendorId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isFormEditable && !!purchaseOrder}>
                <SelectTrigger id="vendorId"><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                <SelectContent>
                  {vendorContacts.map(contact => (
                    <SelectItem key={contact.id} value={contact.id.toString()}>{contact.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.vendorId && <p className="text-sm text-destructive mt-1">{errors.vendorId.message}</p>}
        </div>
        <div>
          <Label htmlFor="date">Fecha de Orden</Label>
          <Input id="date" type="date" {...register("date")} disabled={!isFormEditable && !!purchaseOrder} />
          {errors.date && <p className="text-sm text-destructive mt-1">{errors.date.message}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" {...register("description")} placeholder="Ej. Compra mensual de material de oficina" disabled={!isFormEditable && !!purchaseOrder} />
        {errors.description && <p className="text-sm text-destructive mt-1">{errors.description.message}</p>}
      </div>
       <div>
        <Label htmlFor="status">Estado</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isStatusEditable}>
              <SelectTrigger id="status"><SelectValue placeholder="Seleccionar estado..." /></SelectTrigger>
              <SelectContent>
                {purchaseOrder?.status === 'Borrador' && <SelectItem value="Borrador">Borrador</SelectItem>}
                {(isStatusEditable || currentStatus === "Confirmada") && <SelectItem value="Confirmada">Confirmada</SelectItem>}
                {(isStatusEditable || currentStatus === "Enviada") &&<SelectItem value="Enviada">Enviada</SelectItem>}
                {(isStatusEditable || currentStatus === "Recibida") &&<SelectItem value="Recibida">Recibida</SelectItem>}
                {(isStatusEditable || currentStatus === "Cancelada") && <SelectItem value="Cancelada">Cancelada</SelectItem>}
                {currentStatus === 'Pagado' && <SelectItem value="Pagado" disabled>Pagado</SelectItem>}
              </SelectContent>
            </Select>
          )}
        />
        {errors.status && <p className="text-sm text-destructive mt-1">{errors.status.message}</p>}
      </div>

      <div className="space-y-3">
        <Label className="text-md font-medium">Artículos de la Orden</Label>
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
                    disabled={!isFormEditable}
                  >
                    <SelectTrigger><SelectValue placeholder="Seleccionar artículo..." /></SelectTrigger>
                    <SelectContent>
                      {inventoryItems.map(item => (
                        <SelectItem key={item.id} value={item.id!}>{item.name} ({item.sku}) - Costo: €{item.unitPrice.toFixed(2)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.items?.[index]?.inventoryItemId && <p className="text-sm text-destructive mt-1">{errors.items[index]?.inventoryItemId?.message}</p>}
            </div>
            <div className="col-span-2">
              <Label htmlFor={`items.${index}.quantity`} className="text-xs">Cantidad</Label>
              <Input id={`items.${index}.quantity`} type="number" {...register(`items.${index}.quantity`, { valueAsNumber: true, min: 1 })} disabled={!isFormEditable} />
              {errors.items?.[index]?.quantity && <p className="text-sm text-destructive mt-1">{errors.items[index]?.quantity?.message}</p>}
            </div>
            <div className="col-span-3">
              <Label htmlFor={`items.${index}.unitPrice`} className="text-xs">Costo Unit. (€)</Label>
              <Input id={`items.${index}.unitPrice`} type="number" step="0.01" {...register(`items.${index}.unitPrice`, { valueAsNumber: true })} disabled={!isFormEditable}/>
              {errors.items?.[index]?.unitPrice && <p className="text-sm text-destructive mt-1">{errors.items[index]?.unitPrice?.message}</p>}
            </div>
            <div className="col-span-2 flex items-end">
              {isFormEditable && fields.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-destructive hover:text-destructive">
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
         {isFormEditable && (
            <Button type="button" variant="outline" size="sm" onClick={() => append({ inventoryItemId: '', quantity: 1, unitPrice: 0 })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Artículo
            </Button>
         )}
        {errors.items && typeof errors.items === 'object' && 'message' in errors.items && <p className="text-sm text-destructive mt-1">{errors.items.message as string}</p>}
      </div>

      <div className="text-right font-semibold text-lg">
        Monto Total: €{totalOrderAmount.toFixed(2)}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting || purchaseOrder?.status === 'Pagado'}>
          {isSubmitting ? (purchaseOrder ? "Guardando..." : "Creando...") : (purchaseOrder ? "Guardar Cambios" : "Crear Orden")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function PurchasesPage() {
  const [purchaseOrders, setPurchaseOrders] = useState<AppPurchaseOrder[]>([]);
  const [inventoryItems, setInventoryItems] = useState<(InventoryItemFormInput & {id:string})[]>([]);
  const [vendorContacts, setVendorContacts] = useState<(ContactFormInput & {id: string})[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<AppPurchaseOrder | undefined>(undefined);
  const [deletingPurchaseOrderId, setDeletingPurchaseOrderId] = useState<string | null>(null);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const refreshData = async () => {
    try {
        const [serverPOs, serverInvItems, serverVendorContacts] = await Promise.all([
            getPurchaseOrders(),
            getInventoryItems(),
            getContacts({ type: 'Proveedor' })
        ]);
        setPurchaseOrders(serverPOs.map(po => ({ ...po, description: po.description || '', items: [] /* Los items completos se cargan al editar */ })));
        setInventoryItems(serverInvItems);
        setVendorContacts(serverVendorContacts);
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos iniciales."})
        console.error("Error refreshing purchase data:", error);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleAddSubmit = async (data: PurchaseOrderFormInput) => {
    const response = await addPurchaseOrder(data);
    if (response.success && response.purchaseOrder) {
      toast({ title: "Éxito", description: response.message });
      refreshData();
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir la orden de compra.", errors: response.errors });
    }
  };

  const handleEditSubmit = async (data: PurchaseOrderFormInput) => {
    if (!editingPurchaseOrder?.id) return;
    const dataForUpdate = { ...data, id: editingPurchaseOrder.id, poNumber: editingPurchaseOrder.poNumber, totalAmount: editingPurchaseOrder.totalAmount };

    const response = await updatePurchaseOrder(dataForUpdate);
    if (response.success && response.purchaseOrder) {
      toast({ title: "Éxito", description: response.message });
      refreshData();
      setIsEditDialogOpen(false);
      setEditingPurchaseOrder(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar la orden de compra.", errors: response.errors });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPurchaseOrderId) return;
    const response = await deletePurchaseOrder(deletingPurchaseOrderId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      refreshData();
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar la orden de compra." });
    }
    setDeletingPurchaseOrderId(null);
  };

  const openEditDialog = async (poId: string) => {
    try {
        const orderToEdit = await getPurchaseOrderById(poId);
        if (orderToEdit) {
            setEditingPurchaseOrder(orderToEdit as AppPurchaseOrder); // Cast as AppPurchaseOrder as it includes items.
            setIsEditDialogOpen(true);
        } else {
            toast({ variant: "destructive", title: "Error", description: "No se pudo cargar la orden para editar."});
        }
    } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Error al cargar la orden." });
        console.error("Error fetching purchase order for edit:", error);
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
                  Realiza seguimiento y gestiona todas las órdenes de compra.
                </CardDescription>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-5 w-5" /> Nueva Orden de Compra
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nueva Orden de Compra</DialogTitle>
                  <DialogDescription>Completa los detalles para crear una nueva OC.</DialogDescription>
                </DialogHeader>
                <PurchaseOrderForm inventoryItems={inventoryItems} vendorContacts={vendorContacts} onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar OC (N°, Proveedor, Descripción)..." className="pl-10 w-full" />
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
              <TabsTrigger value="Recibida">Recibida</TabsTrigger>
              <TabsTrigger value="Pagado">Pagado</TabsTrigger>
              <TabsTrigger value="Cancelada">Cancelada</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° OC</TableHead>
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchaseOrders.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber || 'N/A'}</TableCell>
                          <TableCell>{po.vendorName || po.vendorId}</TableCell>
                          <TableCell>{po.date}</TableCell>
                          <TableCell className="max-w-sm truncate">{po.description || "N/A"}</TableCell>
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
                                <DropdownMenuItem onClick={() => openEditDialog(po.id!)} disabled={po.status === 'Pagado'}>
                                  <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => {e.preventDefault(); setDeletingPurchaseOrderId(po.id! )}} className="text-destructive dark:text-destructive-foreground focus:text-destructive" disabled={!['Borrador', 'Cancelada'].includes(po.status)}>
                                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>Se eliminará la OC {purchaseOrders.find(p=>p.id === deletingPurchaseOrderId)?.poNumber}. Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingPurchaseOrderId(null)}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                       {filteredPurchaseOrders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
        </CardFooter>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingPurchaseOrder(undefined);}}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Orden de Compra: {editingPurchaseOrder?.poNumber}</DialogTitle>
            <DialogDescription>Actualiza los detalles de la OC. La edición de artículos solo es posible si la OC está en estado "Borrador".</DialogDescription>
          </DialogHeader>
          {editingPurchaseOrder && <PurchaseOrderForm purchaseOrder={editingPurchaseOrder} inventoryItems={inventoryItems} vendorContacts={vendorContacts} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingPurchaseOrder(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
