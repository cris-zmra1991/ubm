
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Boxes, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, TrendingUp, TrendingDown, AlertTriangle, Package, Archive, DollarSign } from "lucide-react";
import Image from "next/image";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  unitPrice: number;
  imageUrl?: string;
  supplier?: string;
}

const inventoryData: InventoryItem[] = [
  { id: "1", name: "Ratón Inalámbrico Pro", sku: "WM-PRO-001", category: "Electrónica", currentStock: 45, reorderLevel: 20, unitPrice: 29.99, imageUrl: "https://placehold.co/60x60.png?text=Mouse", supplier: "TechSupplies Ltd." },
  { id: "2", name: "Teclado Ergonómico", sku: "EK-BLK-005", category: "Electrónica", currentStock: 15, reorderLevel: 10, unitPrice: 79.50, imageUrl: "https://placehold.co/60x60.png?text=Keyboard", supplier: "OfficeComfort Inc." },
  { id: "3", name: "Papel de Impresora A4 (500 Hojas)", sku: "PP-A4-500", category: "Suministros de Oficina", currentStock: 150, reorderLevel: 50, unitPrice: 5.99, supplier: "PaperMill Corp." },
  { id: "4", name: "Granos de Café Orgánico (1kg)", sku: "CF-ORG-1KG", category: "Despensa", currentStock: 8, reorderLevel: 10, unitPrice: 18.75, imageUrl: "https://placehold.co/60x60.png?text=Coffee", supplier: "Beans R Us" },
  { id: "5", name: "Spray Limpiador (Multiusos)", sku: "CS-AP-500ML", category: "Limpieza", currentStock: 30, reorderLevel: 15, unitPrice: 3.49, supplier: "CleanCo" },
];

export default function InventoryPage() {
  const lowStockItems = inventoryData.filter(item => item.currentStock <= item.reorderLevel);
  const totalInventoryValue = inventoryData.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);

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
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Artículo
            </Button>
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
                <div className="text-2xl font-bold">{inventoryData.length}</div>
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
                  <TableHead className="w-[80px]">Imagen</TableHead>
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
                {inventoryData.map((item) => (
                  <TableRow key={item.id} className={item.currentStock <= item.reorderLevel ? "bg-red-500/5 dark:bg-red-700/10" : ""}>
                    <TableCell>
                      <Image 
                        src={item.imageUrl || "https://placehold.co/60x60.png?text=Artículo"} 
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
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" /> Editar Artículo
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <TrendingUp className="mr-2 h-4 w-4" /> Ajustar Stock
                          </DropdownMenuItem>
                           <DropdownMenuItem>
                            <Archive className="mr-2 h-4 w-4" /> Archivar Artículo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar Artículo
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {inventoryData.length === 0 && (
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
          <p className="text-sm text-muted-foreground">Mostrando {inventoryData.length} de {inventoryData.length} artículos.</p>
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
