
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Store, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, FileText, CreditCard, CheckCircle, XCircle, Hourglass, PackageCheck } from "lucide-react";
import Link from "next/link";

interface SaleOrder {
  id: string;
  invoiceNumber: string;
  customer: string;
  date: string;
  totalAmount: number;
  status: "Borrador" | "Confirmada" | "Enviada" | "Entregada" | "Pagada" | "Cancelada";
}

const salesOrdersData: SaleOrder[] = [
  { id: "1", invoiceNumber: "INV-2024-001", customer: "Cliente X", date: "2024-07-10", totalAmount: 750.50, status: "Pagada" },
  { id: "2", invoiceNumber: "INV-2024-002", customer: "Cliente Y", date: "2024-07-12", totalAmount: 1200.00, status: "Entregada" },
  { id: "3", invoiceNumber: "INV-2024-003", customer: "Patrón Z", date: "2024-07-15", totalAmount: 350.25, status: "Enviada" },
  { id: "4", invoiceNumber: "INV-2024-004", customer: "Comprador A", date: "2024-07-18", totalAmount: 1800.70, status: "Confirmada" },
  { id: "5", invoiceNumber: "INV-2024-005", customer: "Comprador B", date: "2024-07-20", totalAmount: 95.00, status: "Borrador" },
  { id: "6", invoiceNumber: "INV-2024-006", customer: "Cliente C", date: "2024-07-21", totalAmount: 420.00, status: "Cancelada" },
];

const getStatusBadge = (status: SaleOrder["status"]) => {
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

export default function SalesPage() {
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
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Nueva Venta / Factura
            </Button>
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

          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-4">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="draft">Borrador</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmadas</TabsTrigger>
              <TabsTrigger value="shipped">Enviadas</TabsTrigger>
              <TabsTrigger value="delivered">Entregadas</TabsTrigger>
              <TabsTrigger value="paid">Pagadas</TabsTrigger>
            </TabsList>
            
            {["all", "draft", "confirmed", "shipped", "delivered", "paid"].map(tabValue => (
              <TabsContent key={tabValue} value={tabValue}>
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
                      {salesOrdersData.filter(sale => tabValue === "all" || sale.status.toLowerCase() === tabValue.toLowerCase()).map((sale) => (
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
                                <DropdownMenuItem>
                                  <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="mr-2 h-4 w-4" /> Ver PDF
                                </DropdownMenuItem>
                                {sale.status === "Confirmada" && <DropdownMenuItem><Store className="mr-2 h-4 w-4" /> Marcar como Enviada</DropdownMenuItem>}
                                {sale.status === "Enviada" && <DropdownMenuItem><PackageCheck className="mr-2 h-4 w-4" /> Marcar como Entregada</DropdownMenuItem>}
                                {(sale.status === "Entregada" || sale.status === "Confirmada") && <DropdownMenuItem><CreditCard className="mr-2 h-4 w-4" /> Marcar como Pagada</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {salesOrdersData.filter(sale => tabValue === "all" || sale.status.toLowerCase() === tabValue.toLowerCase()).length === 0 && (
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
            ))}
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
           <p className="text-sm text-muted-foreground">Mostrando {salesOrdersData.length} de {salesOrdersData.length} órdenes de venta.</p>
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
