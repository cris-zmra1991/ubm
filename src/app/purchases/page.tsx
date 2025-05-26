
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShoppingCart, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, FileText, Truck, CheckCircle, XCircle, Hourglass } from "lucide-react";
import Link from "next/link";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  date: string;
  totalAmount: number;
  status: "Borrador" | "Confirmada" | "Enviada" | "Recibida" | "Cancelada";
}

const purchaseOrdersData: PurchaseOrder[] = [
  { id: "1", poNumber: "PO-2024-001", vendor: "Proveedor Alpha", date: "2024-07-15", totalAmount: 1250.75, status: "Recibida" },
  { id: "2", poNumber: "PO-2024-002", vendor: "Proveedor Beta", date: "2024-07-18", totalAmount: 875.00, status: "Enviada" },
  { id: "3", poNumber: "PO-2024-003", vendor: "Vendedor Gamma", date: "2024-07-20", totalAmount: 2300.50, status: "Confirmada" },
  { id: "4", poNumber: "PO-2024-004", vendor: "Proveedor Delta", date: "2024-07-22", totalAmount: 550.20, status: "Borrador" },
  { id: "5", poNumber: "PO-2024-005", vendor: "Proveedor Epsilon", date: "2024-07-23", totalAmount: 150.00, status: "Cancelada" },
];

const getStatusBadge = (status: PurchaseOrder["status"]) => {
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


export default function PurchasesPage() {
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
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Nueva Orden de Compra
            </Button>
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

          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 mb-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="draft">Borrador</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmadas</TabsTrigger>
              <TabsTrigger value="shipped">Enviadas</TabsTrigger>
              <TabsTrigger value="received">Recibidas</TabsTrigger>
            </TabsList>
            
            {["all", "draft", "confirmed", "shipped", "received"].map(tabValue => (
              <TabsContent key={tabValue} value={tabValue}>
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
                      {purchaseOrdersData.filter(po => tabValue === "all" || po.status.toLowerCase() === tabValue.toLowerCase()).map((po) => (
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
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="mr-2 h-4 w-4" /> Ver PDF
                                </DropdownMenuItem>
                                {po.status === "Borrador" && <DropdownMenuItem><CheckCircle className="mr-2 h-4 w-4" /> Confirmar Orden</DropdownMenuItem>}
                                {po.status === "Confirmada" && <DropdownMenuItem><Truck className="mr-2 h-4 w-4" /> Marcar como Enviada</DropdownMenuItem>}
                                {po.status === "Enviada" && <DropdownMenuItem><CheckCircle className="mr-2 h-4 w-4" /> Marcar como Recibida</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                       {purchaseOrdersData.filter(po => tabValue === "all" || po.status.toLowerCase() === tabValue.toLowerCase()).length === 0 && (
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
            ))}
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Mostrando {purchaseOrdersData.length} de {purchaseOrdersData.length} órdenes de compra.</p>
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
