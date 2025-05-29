
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Boxes, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, TrendingUp, AlertTriangle, Package, Archive, DollarSign, FileCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InventoryItemSchema, AdjustStockSchema } from "@/app/schemas/inventory.schemas";
import { type InventoryItemFormInput, type AdjustStockFormInput, addInventoryItem, updateInventoryItem, deleteInventoryItem, adjustStock, getInventoryItems } from "@/app/actions/inventory.actions";
import { getAccounts, type AccountWithDetails } from "@/app/actions/accounting.actions";
import { useToast } from "@/hooks/use-toast";


function InventoryItemForm({ item, accounts, onFormSubmit, closeDialog }: { item?: InventoryItemFormInput, accounts: AccountWithDetails[], onFormSubmit: (data: InventoryItemFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<InventoryItemFormInput>({
    resolver: zodResolver(InventoryItemSchema),
    defaultValues: item || {
      name: '', sku: '', category: '', currentStock: 0, reorderLevel: 0, unitPrice: 0, imageUrl: '', supplier: '',
      defaultDebitAccountId: null, defaultCreditAccountId: null, feePercentage: null, salePrice: null,
    },
  });

  const unitPrice = watch("unitPrice");
  const feePercentage = watch("feePercentage");

  useEffect(() => {
    if (feePercentage !== null && feePercentage !== undefined && unitPrice > 0) {
      const calculatedSalePrice = unitPrice * (1 + feePercentage / 100);
      setValue("salePrice", parseFloat(calculatedSalePrice.toFixed(2)));
    }
  }, [unitPrice, feePercentage, setValue]);


  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3 max-h-[80vh] overflow-y-auto p-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><Label htmlFor="name">Nombre del Producto</Label><Input id="name" {...register("name")} />{errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}</div>
        <div><Label htmlFor="sku">SKU</Label><Input id="sku" {...register("sku")} />{errors.sku && <p className="text-sm text-destructive mt-1">{errors.sku.message}</p>}</div>
      </div>
      <div><Label htmlFor="category">Categoría</Label><Input id="category" {...register("category")} />{errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}</div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><Label htmlFor="currentStock">Stock Actual</Label><Input id="currentStock" type="number" {...register("currentStock", {valueAsNumber: true})} />{errors.currentStock && <p className="text-sm text-destructive mt-1">{errors.currentStock.message}</p>}</div>
        <div><Label htmlFor="reorderLevel">Nivel de Pedido</Label><Input id="reorderLevel" type="number" {...register("reorderLevel", {valueAsNumber: true})} />{errors.reorderLevel && <p className="text-sm text-destructive mt-1">{errors.reorderLevel.message}</p>}</div>
        <div><Label htmlFor="unitPrice">Precio Costo (€)</Label><Input id="unitPrice" type="number" step="0.01" {...register("unitPrice", {valueAsNumber: true})} />{errors.unitPrice && <p className="text-sm text-destructive mt-1">{errors.unitPrice.message}</p>}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <Label htmlFor="feePercentage">Porcentaje de Ganancia (%) (Opcional)</Label>
            <Input id="feePercentage" type="number" step="0.01" {...register("feePercentage", {setValueAs: (v) => v === "" ? null : parseFloat(v)})} placeholder="Ej: 25 para 25%" />
            {errors.feePercentage && <p className="text-sm text-destructive mt-1">{errors.feePercentage.message}</p>}
        </div>
        <div>
            <Label htmlFor="salePrice">Precio de Venta (€) (Opcional)</Label>
            <Input id="salePrice" type="number" step="0.01" {...register("salePrice", {setValueAs: (v) => v === "" ? null : parseFloat(v)})} placeholder="Si se deja vacío, se usa Costo + Fee"/>
            {errors.salePrice && <p className="text-sm text-destructive mt-1">{errors.salePrice.message}</p>}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="defaultDebitAccountId">Cta. Débito/Inventario (Contabilidad)</Label>
          <Controller name="defaultDebitAccountId" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.type === 'Activo' || a.type === 'Gasto').map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.defaultDebitAccountId && <p className="text-sm text-destructive mt-1">{errors.defaultDebitAccountId.message}</p>}
        </div>
        <div>
          <Label htmlFor="defaultCreditAccountId">Cta. Crédito/Ingreso (Contabilidad)</Label>
           <Controller name="defaultCreditAccountId" control={control} render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
              <SelectContent>{accounts.filter(a => a.type === 'Ingreso').map(acc => <SelectItem key={acc.id} value={acc.id.toString()}>{acc.code} - {acc.name}</SelectItem>)}</SelectContent>
            </Select>
          )} />
          {errors.defaultCreditAccountId && <p className="text-sm text-destructive mt-1">{errors.defaultCreditAccountId.message}</p>}
        </div>
      </div>

      <div><Label htmlFor="supplier">Proveedor (Opcional)</Label><Input id="supplier" {...register("supplier")} />{errors.supplier && <p className="text-sm text-destructive mt-1">{errors.supplier.message}</p>}</div>
      <div><Label htmlFor="imageUrl">URL de Imagen (Opcional)</Label><Input id="imageUrl" type="url" {...register("imageUrl")} placeholder="https://ejemplo.com/imagen.png" />{errors.imageUrl && <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>}</div>
      
      <DialogFooter className="pt-4">
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (item ? "Guardando..." : "Añadiendo...") : (item ? "Guardar Cambios" : "Añadir Artículo")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AdjustStockForm({ item, onFormSubmit, closeDialog }: { item: InventoryItemFormInput, onFormSubmit: (data: AdjustStockFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AdjustStockFormInput>({
    resolver: zodResolver(AdjustStockSchema),
    defaultValues: {
      itemId: item.id,
      quantityChange: 0,
      reason: '',
    },
  });
  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <p>Ajustando stock para: <strong>{item.name}</strong> (Stock Actual: {item.currentStock})</p>
      <Input type="hidden" {...register("itemId")} />
      <div>
        <Label htmlFor="quantityChange">Cambio de Cantidad (+/-)</Label>
        <Input id="quantityChange" type="number" {...register("quantityChange", {valueAsNumber: true})} placeholder="Ej: 10 o -5"/>
        {errors.quantityChange && <p className="text-sm text-destructive mt-1">{errors.quantityChange.message}</p>}
      </div>
      <div>
        <Label htmlFor="reason">Motivo del Ajuste</Label>
        <Textarea id="reason" {...register("reason")} />
        {errors.reason && <p className="text-sm text-destructive mt-1">{errors.reason.message}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Ajustando..." : "Ajustar Stock"}</Button>
      </DialogFooter>
    </form>
  )
}


export default function InventoryPage() {
  const [inventory, setInventory] = useState<(InventoryItemFormInput & {id: string})[]>([]);
  const [accounts, setAccounts] = useState<AccountWithDetails[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(InventoryItemFormInput & {id: string}) | undefined>(undefined);
  const [isAdjustStockDialogOpen, setIsAdjustStockDialogOpen] = useState(false);
  const [itemToAdjustStock, setItemToAdjustStock] = useState<(InventoryItemFormInput & {id: string}) | undefined>(undefined);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshInventory = async () => {
    const [serverItems, serverAccounts] = await Promise.all([getInventoryItems(), getAccounts()]);
    setInventory(serverItems);
    setAccounts(serverAccounts);
  };

  useEffect(() => {
    refreshInventory();
  }, []);

  const handleAddSubmit = async (data: InventoryItemFormInput) => {
    const response = await addInventoryItem(data);
    if (response.success && response.inventoryItem) {
      toast({ title: "Éxito", description: response.message });
      refreshInventory();
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir el artículo.", errors: response.errors });
    }
  };

  const handleEditSubmit = async (data: InventoryItemFormInput) => {
    if (!editingItem?.id) return;
    const response = await updateInventoryItem({ ...data, id: editingItem.id });
    if (response.success && response.inventoryItem) {
      toast({ title: "Éxito", description: response.message });
      refreshInventory();
      setIsEditDialogOpen(false);
      setEditingItem(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar.", errors: response.errors });
    }
  };

  const handleAdjustStockSubmit = async (data: AdjustStockFormInput) => {
    const response = await adjustStock(data);
    if (response.success && response.inventoryItem) {
      toast({ title: "Éxito", description: response.message });
      refreshInventory();
      setIsAdjustStockDialogOpen(false);
      setItemToAdjustStock(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo ajustar.", errors: response.errors });
    }
  };


  const handleDeleteConfirm = async () => {
    if (!deletingItemId) return;
    const response = await deleteInventoryItem(deletingItemId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      refreshInventory();
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar." });
    }
    setDeletingItemId(null);
  };

  const openEditDialog = (item: InventoryItemFormInput & {id: string}) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const openAdjustStockDialog = (item: InventoryItemFormInput & {id: string}) => {
    setItemToAdjustStock(item);
    setIsAdjustStockDialogOpen(true);
  };

  const lowStockItems = inventory.filter(item => item.currentStock <= item.reorderLevel);
  const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3"><Boxes className="h-8 w-8 text-primary" />
              <div><CardTitle className="text-3xl font-bold">Gestión de Inventario</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">Seguimiento de stock, productos e integración.</CardDescription>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild><Button size="lg" onClick={() => setIsAddDialogOpen(true)}><PlusCircle className="mr-2 h-5 w-5" /> Añadir Artículo</Button></DialogTrigger>
                <DialogContent className="sm:max-w-lg"> {/* Aumentado ancho */}
                    <DialogHeader><DialogTitle>Añadir Nuevo Artículo</DialogTitle><DialogDescription>Detalles del nuevo producto.</DialogDescription></DialogHeader>
                    <InventoryItemForm accounts={accounts} onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Stats Cards */}
          </div>
          {/* Low Stock Alert */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar en inventario..." className="pl-10 w-full" /></div>
            <Button variant="outline"><Filter className="mr-2 h-5 w-5" /> Filtrar</Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                  <TableHead className="w-[60px]">Imagen</TableHead>
                  <TableHead>Nombre</TableHead><TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead><TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">N. Pedido</TableHead>
                  <TableHead className="text-right">Costo (€)</TableHead>
                  <TableHead className="text-right">P. Venta (€)</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id} className={item.currentStock <= item.reorderLevel ? "bg-red-500/5 dark:bg-red-700/10" : ""}>
                    <TableCell><Image src={item.imageUrl || "https://placehold.co/40x40.png?text=N/A"} alt={item.name} width={40} height={40} className="rounded" data-ai-hint={item.category}/></TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku}</TableCell><TableCell>{item.category}</TableCell>
                    <TableCell className="text-right font-semibold">{item.currentStock}</TableCell>
                    <TableCell className="text-right">{item.reorderLevel}</TableCell>
                    <TableCell className="text-right">€{item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">€{(item.salePrice ?? item.unitPrice).toFixed(2)}</TableCell> {/* Muestra precio de venta o costo si no hay pvp */}
                    <TableCell className="text-right">
                      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(item)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAdjustStockDialog(item)}><TrendingUp className="mr-2 h-4 w-4" /> Ajustar Stock</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => {e.preventDefault(); setDeletingItemId(item.id!)}} className="text-destructive dark:text-destructive-foreground focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Estás seguro?</AlertDialogTitle><AlertDialogDescription>Se eliminará {inventory.find(i => i.id === deletingItemId)?.name}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setDeletingItemId(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                           </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {inventory.length === 0 && <TableRow><TableCell colSpan={9} className="h-24 text-center">No hay artículos.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center"><p className="text-sm text-muted-foreground">Mostrando {inventory.length} artículos.</p></CardFooter>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingItem(undefined);}}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Editar Artículo</DialogTitle><DialogDescription>Actualiza detalles.</DialogDescription></DialogHeader>
          {editingItem && <InventoryItemForm item={editingItem} accounts={accounts} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingItem(undefined);}} />}
        </DialogContent>
      </Dialog>
      <Dialog open={isAdjustStockDialogOpen} onOpenChange={(isOpen) => { setIsAdjustStockDialogOpen(isOpen); if (!isOpen) setItemToAdjustStock(undefined);}}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Ajustar Stock</DialogTitle><DialogDescription>Modifica cantidad.</DialogDescription></DialogHeader>
          {itemToAdjustStock && <AdjustStockForm item={itemToAdjustStock} onFormSubmit={handleAdjustStockSubmit} closeDialog={() => {setIsAdjustStockDialogOpen(false); setItemToAdjustStock(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
