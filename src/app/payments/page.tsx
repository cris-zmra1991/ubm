
"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Banknote, CheckCircle, PlusCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PaymentSchema } from "@/app/schemas/payments.schemas";
import { type PaymentFormInput, getPendingPayments, processPayment, type PendingPaymentItem } from "@/app/actions/payments.actions";
import { useToast } from "@/hooks/use-toast";

const paymentMethods = [
  "Transferencia Bancaria", "Efectivo", "Tarjeta de Crédito", "Tarjeta de Débito", "Cheque", "Otro"
];

function ProcessPaymentForm({ pendingItem, onFormSubmit, closeDialog }: { pendingItem: PendingPaymentItem, onFormSubmit: (data: PaymentFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<PaymentFormInput>({
    resolver: zodResolver(PaymentSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      amount: pendingItem.amount_due,
      paymentMethod: undefined,
      referenceNumber: '',
      notes: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <p>Procesando pago para: <strong>{pendingItem.document_number}</strong> ({pendingItem.description})</p>
      <p>Monto Adeudado: <strong>€{pendingItem.amount_due.toFixed(2)}</strong></p>

      <div>
        <Label htmlFor="paymentDate">Fecha de Pago</Label>
        <Input id="paymentDate" type="date" {...register("paymentDate")} />
        {errors.paymentDate && <p className="text-sm text-destructive mt-1">{errors.paymentDate.message}</p>}
      </div>
      <div>
        <Label htmlFor="amount">Monto Pagado (€)</Label>
        <Input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
        {errors.amount && <p className="text-sm text-destructive mt-1">{errors.amount.message}</p>}
      </div>
      <div>
        <Label htmlFor="paymentMethod">Método de Pago</Label>
        <Controller
          name="paymentMethod"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="paymentMethod"><SelectValue placeholder="Seleccionar método..." /></SelectTrigger>
              <SelectContent>
                {paymentMethods.map(method => <SelectItem key={method} value={method}>{method}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        />
        {errors.paymentMethod && <p className="text-sm text-destructive mt-1">{errors.paymentMethod.message}</p>}
      </div>
      <div>
        <Label htmlFor="referenceNumber">Número de Referencia (Opcional)</Label>
        <Input id="referenceNumber" {...register("referenceNumber")} />
        {errors.referenceNumber && <p className="text-sm text-destructive mt-1">{errors.referenceNumber.message}</p>}
      </div>
      <div>
        <Label htmlFor="notes">Notas (Opcional)</Label>
        <Textarea id="notes" {...register("notes")} />
        {errors.notes && <p className="text-sm text-destructive mt-1">{errors.notes.message}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Procesando..." : "Registrar Pago"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function PaymentsPage() {
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentItem[]>([]);
  const [isProcessPaymentDialogOpen, setIsProcessPaymentDialogOpen] = useState(false);
  const [selectedPendingItem, setSelectedPendingItem] = useState<PendingPaymentItem | undefined>(undefined);
  const { toast } = useToast();

  const refreshPendingPayments = async () => {
    const items = await getPendingPayments();
    setPendingPayments(items);
  };

  useEffect(() => {
    refreshPendingPayments();
  }, []);

  const handleProcessPaymentSubmit = async (data: PaymentFormInput) => {
    if (!selectedPendingItem) return;
    const response = await processPayment(data, selectedPendingItem.source_document_type, selectedPendingItem.id);
    if (response.success && response.payment) {
      toast({ title: "Éxito", description: response.message });
      refreshPendingPayments();
      setIsProcessPaymentDialogOpen(false);
      setSelectedPendingItem(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo procesar el pago.", errors: response.errors });
    }
  };

  const openProcessPaymentDialog = (item: PendingPaymentItem) => {
    setSelectedPendingItem(item);
    setIsProcessPaymentDialogOpen(true);
  };

  const getBadgeForType = (type: PendingPaymentItem['source_document_type']) => {
    switch(type) {
      case 'sale_order': return <Badge variant="outline" className="border-green-500/70 bg-green-500/10 text-green-700 dark:text-green-400">Venta</Badge>;
      case 'purchase_order': return <Badge variant="outline" className="border-blue-500/70 bg-blue-500/10 text-blue-700 dark:text-blue-400">Compra</Badge>;
      case 'expense': return <Badge variant="outline" className="border-orange-500/70 bg-orange-500/10 text-orange-700 dark:text-orange-400">Gasto</Badge>;
      default: return <Badge variant="secondary">Otro</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Banknote className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold">Gestión de Pagos</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Procesa y registra los pagos pendientes de ventas, compras y gastos.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <h3 className="text-xl font-semibold">Pagos Pendientes</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Documento N°</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Fecha Vencimiento</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto Adeudado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingPayments.map((item) => (
                  <TableRow key={`${item.source_document_type}-${item.id}`}>
                    <TableCell>{getBadgeForType(item.source_document_type)}</TableCell>
                    <TableCell className="font-medium">{item.document_number}</TableCell>
                    <TableCell>{item.contact_name || "N/A"}</TableCell>
                    <TableCell>{item.due_date}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                    <TableCell className="text-right">€{item.amount_due.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openProcessPaymentDialog(item)}>
                        <CheckCircle className="mr-2 h-4 w-4" /> Procesar Pago
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {pendingPayments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No hay pagos pendientes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Mostrando {pendingPayments.length} pagos pendientes.</p>
        </CardFooter>
      </Card>

      <Dialog open={isProcessPaymentDialogOpen} onOpenChange={(isOpen) => { setIsProcessPaymentDialogOpen(isOpen); if (!isOpen) setSelectedPendingItem(undefined);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Procesar Pago</DialogTitle>
            <DialogDescription>Registra los detalles del pago realizado.</DialogDescription>
          </DialogHeader>
          {selectedPendingItem && <ProcessPaymentForm pendingItem={selectedPendingItem} onFormSubmit={handleProcessPaymentSubmit} closeDialog={() => {setIsProcessPaymentDialogOpen(false); setSelectedPendingItem(undefined);}} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
