
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
  { id: "1", name: "Wireless Mouse Pro", sku: "WM-PRO-001", category: "Electronics", currentStock: 45, reorderLevel: 20, unitPrice: 29.99, imageUrl: "https://placehold.co/60x60.png?text=Mouse", supplier: "TechSupplies Ltd." },
  { id: "2", name: "Ergonomic Keyboard", sku: "EK-BLK-005", category: "Electronics", currentStock: 15, reorderLevel: 10, unitPrice: 79.50, imageUrl: "https://placehold.co/60x60.png?text=Keyboard", supplier: "OfficeComfort Inc." },
  { id: "3", name: "A4 Printer Paper (500 Sheets)", sku: "PP-A4-500", category: "Office Supplies", currentStock: 150, reorderLevel: 50, unitPrice: 5.99, supplier: "PaperMill Corp." },
  { id: "4", name: "Organic Coffee Beans (1kg)", sku: "CF-ORG-1KG", category: "Pantry", currentStock: 8, reorderLevel: 10, unitPrice: 18.75, imageUrl: "https://placehold.co/60x60.png?text=Coffee", supplier: "Beans R Us" },
  { id: "5", name: "Cleaning Spray (All Purpose)", sku: "CS-AP-500ML", category: "Cleaning", currentStock: 30, reorderLevel: 15, unitPrice: 3.49, supplier: "CleanCo" },
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
                <CardTitle className="text-3xl font-bold">Inventory Management</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Track stock levels, manage products, and integrate with sales & purchases.
                </CardDescription>
              </div>
            </div>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Add New Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Unique Items</CardTitle>
                <Package className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inventoryData.length}</div>
                <p className="text-xs text-muted-foreground">Different products in stock</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Items</CardTitle>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{lowStockItems.length}</div>
                <p className="text-xs text-muted-foreground">Items at or below reorder level</p>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Inventory Value</CardTitle>
                <DollarSign className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">€{totalInventoryValue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Estimated value of all stock</p>
              </CardContent>
            </Card>
          </div>

          {lowStockItems.length > 0 && (
            <Alert variant="destructive" className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle>Low Stock Alert!</AlertTitle>
              <AlertDescription>
                {lowStockItems.length} item(s) are currently at or below their reorder level. Consider placing new purchase orders.
                <ul className="list-disc list-inside mt-1 text-xs">
                  {lowStockItems.slice(0,3).map(item => <li key={item.id}>{item.name} (Stock: {item.currentStock})</li>)}
                  {lowStockItems.length > 3 && <li>And {lowStockItems.length - 3} more...</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search inventory (e.g., name, SKU, category)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filter
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Image</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Reorder Level</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventoryData.map((item) => (
                  <TableRow key={item.id} className={item.currentStock <= item.reorderLevel ? "bg-red-500/5 dark:bg-red-700/10" : ""}>
                    <TableCell>
                      <Image 
                        src={item.imageUrl || "https://placehold.co/60x60.png?text=Item"} 
                        alt={item.name} 
                        width={40} 
                        height={40} 
                        className="rounded" 
                        data-ai-hint={item.category === "Electronics" ? "electronic device" : "product image"}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell className="text-right font-semibold">{item.currentStock}</TableCell>
                    <TableCell className="text-right">{item.reorderLevel}</TableCell>
                    <TableCell className="text-right">€{item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell>{item.supplier || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" /> Edit Item
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <TrendingUp className="mr-2 h-4 w-4" /> Adjust Stock
                          </DropdownMenuItem>
                           <DropdownMenuItem>
                            <Archive className="mr-2 h-4 w-4" /> Archive Item
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {inventoryData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      No items in inventory. Add your first product!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Showing {inventoryData.length} of {inventoryData.length} items.</p>
          {/* Pagination placeholder */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Previous</Button>
            <Button variant="outline" size="sm" disabled>Next</Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
