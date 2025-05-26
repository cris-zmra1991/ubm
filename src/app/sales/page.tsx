
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
  status: "Draft" | "Confirmed" | "Shipped" | "Delivered" | "Paid" | "Cancelled";
}

const salesOrdersData: SaleOrder[] = [
  { id: "1", invoiceNumber: "INV-2024-001", customer: "Customer X", date: "2024-07-10", totalAmount: 750.50, status: "Paid" },
  { id: "2", invoiceNumber: "INV-2024-002", customer: "Client Y", date: "2024-07-12", totalAmount: 1200.00, status: "Delivered" },
  { id: "3", invoiceNumber: "INV-2024-003", customer: "Patron Z", date: "2024-07-15", totalAmount: 350.25, status: "Shipped" },
  { id: "4", invoiceNumber: "INV-2024-004", customer: "Shopper A", date: "2024-07-18", totalAmount: 1800.70, status: "Confirmed" },
  { id: "5", invoiceNumber: "INV-2024-005", customer: "Buyer B", date: "2024-07-20", totalAmount: 95.00, status: "Draft" },
  { id: "6", invoiceNumber: "INV-2024-006", customer: "Client C", date: "2024-07-21", totalAmount: 420.00, status: "Cancelled" },
];

const getStatusBadge = (status: SaleOrder["status"]) => {
  switch (status) {
    case "Draft":
      return <Badge variant="outline" className="border-yellow-500/70 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"><Hourglass className="mr-1 h-3 w-3" />Draft</Badge>;
    case "Confirmed":
      return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Confirmed</Badge>;
    case "Shipped":
      return <Badge variant="outline" className="border-purple-500/70 bg-purple-500/10 text-purple-700 dark:text-purple-400"><Store className="mr-1 h-3 w-3" />Shipped</Badge>;
    case "Delivered":
      return <Badge variant="outline" className="border-teal-500/70 bg-teal-500/10 text-teal-700 dark:text-teal-400"><PackageCheck className="mr-1 h-3 w-3" />Delivered</Badge>;
    case "Paid":
      return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30"><CreditCard className="mr-1 h-3 w-3" />Paid</Badge>;
    case "Cancelled":
      return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Cancelled</Badge>;
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
                <CardTitle className="text-3xl font-bold">Sales Management</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Oversee sales orders and invoices, from creation to payment.
                </CardDescription>
              </div>
            </div>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> New Sale / Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search sales (e.g., invoice #, customer)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filter
            </Button>
          </div>

          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="shipped">Shipped</TabsTrigger>
              <TabsTrigger value="delivered">Delivered</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
            </TabsList>
            
            {["all", "draft", "confirmed", "shipped", "delivered", "paid"].map(tabValue => (
              <TabsContent key={tabValue} value={tabValue}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesOrdersData.filter(sale => tabValue === "all" || sale.status.toLowerCase() === tabValue).map((sale) => (
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
                                  <Edit className="mr-2 h-4 w-4" /> View/Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="mr-2 h-4 w-4" /> View PDF
                                </DropdownMenuItem>
                                {sale.status === "Confirmed" && <DropdownMenuItem><Store className="mr-2 h-4 w-4" /> Mark as Shipped</DropdownMenuItem>}
                                {sale.status === "Shipped" && <DropdownMenuItem><PackageCheck className="mr-2 h-4 w-4" /> Mark as Delivered</DropdownMenuItem>}
                                {(sale.status === "Delivered" || sale.status === "Confirmed") && <DropdownMenuItem><CreditCard className="mr-2 h-4 w-4" /> Mark as Paid</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {salesOrdersData.filter(sale => tabValue === "all" || sale.status.toLowerCase() === tabValue).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No sales orders in this category.
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
           <p className="text-sm text-muted-foreground">Showing {salesOrdersData.length} of {salesOrdersData.length} sales orders.</p>
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

