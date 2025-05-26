
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
  status: "Draft" | "Confirmed" | "Shipped" | "Received" | "Cancelled";
}

const purchaseOrdersData: PurchaseOrder[] = [
  { id: "1", poNumber: "PO-2024-001", vendor: "Supplier Alpha", date: "2024-07-15", totalAmount: 1250.75, status: "Received" },
  { id: "2", poNumber: "PO-2024-002", vendor: "Provider Beta", date: "2024-07-18", totalAmount: 875.00, status: "Shipped" },
  { id: "3", poNumber: "PO-2024-003", vendor: "Vendor Gamma", date: "2024-07-20", totalAmount: 2300.50, status: "Confirmed" },
  { id: "4", poNumber: "PO-2024-004", vendor: "Supplier Delta", date: "2024-07-22", totalAmount: 550.20, status: "Draft" },
  { id: "5", poNumber: "PO-2024-005", vendor: "Provider Epsilon", date: "2024-07-23", totalAmount: 150.00, status: "Cancelled" },
];

const getStatusBadge = (status: PurchaseOrder["status"]) => {
  switch (status) {
    case "Draft":
      return <Badge variant="outline" className="border-yellow-500/70 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"><Hourglass className="mr-1 h-3 w-3" />Draft</Badge>;
    case "Confirmed":
      return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400"><CheckCircle className="mr-1 h-3 w-3" />Confirmed</Badge>;
    case "Shipped":
      return <Badge variant="outline" className="border-purple-500/70 bg-purple-500/10 text-purple-700 dark:text-purple-400"><Truck className="mr-1 h-3 w-3" />Shipped</Badge>;
    case "Received":
      return <Badge variant="default" className="bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30"><CheckCircle className="mr-1 h-3 w-3" />Received</Badge>;
    case "Cancelled":
      return <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:bg-red-700/30 dark:text-red-300 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Cancelled</Badge>;
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
                <CardTitle className="text-3xl font-bold">Purchase Management</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Track and manage all purchase orders, from draft to completion.
                </CardDescription>
              </div>
            </div>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> New Purchase Order
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search purchase orders (e.g., PO number, vendor)..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filter
            </Button>
          </div>

          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
              <TabsTrigger value="shipped">Shipped</TabsTrigger>
              <TabsTrigger value="received">Received</TabsTrigger>
            </TabsList>
            
            {["all", "draft", "confirmed", "shipped", "received"].map(tabValue => (
              <TabsContent key={tabValue} value={tabValue}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrdersData.filter(po => tabValue === "all" || po.status.toLowerCase() === tabValue).map((po) => (
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
                                  <Edit className="mr-2 h-4 w-4" /> View/Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <FileText className="mr-2 h-4 w-4" /> View PDF
                                </DropdownMenuItem>
                                {po.status === "Draft" && <DropdownMenuItem><CheckCircle className="mr-2 h-4 w-4" /> Confirm Order</DropdownMenuItem>}
                                {po.status === "Confirmed" && <DropdownMenuItem><Truck className="mr-2 h-4 w-4" /> Mark as Shipped</DropdownMenuItem>}
                                {po.status === "Shipped" && <DropdownMenuItem><CheckCircle className="mr-2 h-4 w-4" /> Mark as Received</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                       {purchaseOrdersData.filter(po => tabValue === "all" || po.status.toLowerCase() === tabValue).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            No purchase orders in this category.
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
          <p className="text-sm text-muted-foreground">Showing {purchaseOrdersData.length} of {purchaseOrdersData.length} purchase orders.</p>
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
