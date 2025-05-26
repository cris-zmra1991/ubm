
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Boxes, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, TrendingUp, AlertTriangle, Package, Archive, DollarSign } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { InventoryItemSchema, AdjustStockSchema, type InventoryItemFormInput, type AdjustStockFormInput, addInventoryItem, updateInventoryItem, deleteInventoryItem, adjustStock, getInventoryItems } from "@/app/actions/inventory.actions";
import { useToast } from "@/hooks/use-toast";


function InventoryItemForm({ item, onFormSubmit, closeDialog }: { item?: InventoryItemFormInput, onFormSubmit: (data: InventoryItemFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<InventoryItemFormInput>({
    resolver: zodResolver(InventoryItemSchema),
    defaultValues: item || {
      name: '',
      sku: '',
      category: '',
      currentStock: 0,
      reorderLevel: 0,
      unitPrice: 0,
      imageUrl: '',
      supplier: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Nombre del Producto</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" {...register("sku")} />
          {errors.sku && <p className="text-sm text-destructive mt-1">{errors.sku.message}</p>}
        </div>
      </div>
       <div>
        <Label htmlFor="category">Categoría</Label>
        <Input id="category" {...register("category")} />
        {errors.category && <p className="text-sm text-destructive mt-1">{errors.category.message}</p>}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="currentStock">Stock Actual</Label>
          <Input id="currentStock" type="number" {...register("currentStock")} />
          {errors.currentStock && <p className="text-sm text-destructive mt-1">{errors.currentStock.message}</p>}
        </div>
        <div>
          <Label htmlFor="reorderLevel">Nivel de Pedido</Label>
          <Input id="reorderLevel" type="number" {...register("reorderLevel")} />
          {errors.reorderLevel && <p className="text-sm text-destructive mt-1">{errors.reorderLevel.message}</p>}
        </div>
        <div>
          <Label htmlFor="unitPrice">Precio Unit. (€)</Label>
          <Input id="unitPrice" type="number" step="0.01" {...register("unitPrice")} />
          {errors.unitPrice && <p className="text-sm text-destructive mt-1">{errors.unitPrice.message}</p>}
        </div>
      </div>
      <div>
        <Label htmlFor="supplier">Proveedor (Opcional)</Label>
        <Input id="supplier" {...register("supplier")} />
        {errors.supplier && <p className="text-sm text-destructive mt-1">{errors.supplier.message}</p>}
      </div>
      <div>
        <Label htmlFor="imageUrl">URL de Imagen (Opcional)</Label>
        <Input id="imageUrl" type="url" {...register("imageUrl")} placeholder="https://ejemplo.com/imagen.png" />
        {errors.imageUrl && <p className="text-sm text-destructive mt-1">{errors.imageUrl.message}</p>}
      </div>
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
        <Input id="quantityChange" type="number" {...register("quantityChange")} placeholder="Ej: 10 o -5"/>
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
  const [inventory, setInventory] = useState<InventoryItemFormInput[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemFormInput | undefined>(undefined);
  const [isAdjustStockDialogOpen, setIsAdjustStockDialogOpen] = useState(false);
  const [itemToAdjustStock, setItemToAdjustStock] = useState<InventoryItemFormInput | undefined>(undefined);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshInventory = async () => {
    const serverItems = await getInventoryItems();
    setInventory(serverItems);
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
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar el artículo.", errors: response.errors });
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
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo ajustar el stock.", errors: response.errors });
    }
  };


  const handleDeleteConfirm = async () => {
    if (!deletingItemId) return;
    const response = await deleteInventoryItem(deletingItemId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      refreshInventory();
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar el artículo." });
    }
    setDeletingItemId(null);
  };

  const openEditDialog = (item: InventoryItemFormInput) => {
    setEditingItem(item);
    setIsEditDialogOpen(true);
  };

  const openAdjustStockDialog = (item: InventoryItemFormInput) => {
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
            <div className="flex items-center gap-3">
              <Boxes className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-3xl font-bold">Gestión de Inventario</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Realiza seguimiento de niveles de stock, gestiona productos e integra con ventas y compras.
                </CardDescription>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Artículo
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Añadir Nuevo Artículo al Inventario</DialogTitle>
                        <DialogDescription>Completa los detalles del nuevo producto.</DialogDescription>
                    </DialogHeader>
                    <InventoryItemForm onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
                </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Artículos Únicos Totales</CardTitle>
                <Package className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventory.length}</div>
                <p className="text-xs text-muted-foreground">Productos diferentes en stock</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Artículos con Bajo Stock</CardTitle>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lowStockItems.length}</div>
                <p className="text-xs text-muted-foreground">Artículos en o por debajo del nivel de pedido</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Valor Total del Inventario</CardTitle>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{totalInventoryValue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Valor estimado de todo el stock</p>
              </CardContent>
            </Card>
          </div>

          {lowStockItems.length > 0 && (
            <Alert variant="destructive" className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>¡Alerta de Bajo Stock!</AlertTitle>
              <AlertDescription>
                {lowStockItems.length} artículo(s) están actualmente en o por debajo de su nivel de pedido. Considera realizar nuevas órdenes de compra.
                <ul className="list-disc list-inside mt-1 text-xs">
                  {lowStockItems.slice(0,3).map(item => <li key={item.id}>{item.name} (Stock: {item.currentStock})</li>)}
                  {lowStockItems.length > 3 && <li>Y {lowStockItems.length - 3} más...</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar en inventario (ej., nombre, SKU, categoría)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Imagen</TableHead>
                  <TableHead>Nombre del Producto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Stock Actual</TableHead>
                  <TableHead className="text-right">Nivel de Pedido</TableHead>
                  <TableHead className="text-right">Precio Unitario</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id} className={item.currentStock <= item.reorderLevel ? "bg-red-500/5 dark:bg-red-700/10" : ""}>
                    <TableCell>
                      <Image 
                        src={item.imageUrl || "https://placehold.co/40x40.png?text=N/A"} 
                        alt={item.name} 
                        width={40} 
                        height={40} 
                        className="rounded" 
                        data-ai-hint={item.category === "Electrónica" ? "dispositivo electrónico" : "imagen producto"}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right font-semibold">{item.currentStock}</TableCell>
                    <TableCell className="text-right">{item.reorderLevel}</TableCell>
                    <TableCell className="text-right">€{item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell>{item.supplier || "N/D"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(item)}>
                            <Edit className="mr-2 h-4 w-4" /> Editar Artículo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openAdjustStockDialog(item)}>
                            <TrendingUp className="mr-2 h-4 w-4" /> Ajustar Stock
                          </DropdownMenuItem>
                           <DropdownMenuItem> {/* TODO: Implementar Archivar (soft delete o status) */}
                            <Archive className="mr-2 h-4 w-4" /> Archivar Artículo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => {e.preventDefault(); setDeletingItemId(item.id!)}} className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar Artículo
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente el artículo "{inventory.find(i => i.id === deletingItemId)?.name}".
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDeletingItemId(null)}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {inventory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No hay artículos en el inventario. ¡Añade tu primer producto!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Mostrando {inventory.length} de {inventory.length} artículos.</p>
          {/* Pagination placeholder */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          </div>
        </CardFooter>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingItem(undefined);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Artículo de Inventario</DialogTitle>
            <DialogDescription>Actualiza los detalles del producto.</DialogDescription>
          </DialogHeader>
          {editingItem && <InventoryItemForm item={editingItem} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingItem(undefined);}} />}
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustStockDialogOpen} onOpenChange={(isOpen) => { setIsAdjustStockDialogOpen(isOpen); if (!isOpen) setItemToAdjustStock(undefined);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Stock</DialogTitle>
            <DialogDescription>Modifica la cantidad de stock para un artículo.</DialogDescription>
          </DialogHeader>
          {itemToAdjustStock && <AdjustStockForm item={itemToAdjustStock} onFormSubmit={handleAdjustStockSubmit} closeDialog={() => {setIsAdjustStockDialogOpen(false); setItemToAdjustStock(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
