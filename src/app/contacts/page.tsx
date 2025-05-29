
"use client";

import type { SVGProps } from 'react';
import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, Mail, Phone, Building, UserCheck, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ContactSchema } from "@/app/schemas/contacts.schemas";
import { type ContactFormInput, addContact, updateContact, deleteContact, getContacts } from "@/app/actions/contacts.actions";
import { useToast } from "@/hooks/use-toast";

interface AppContact extends ContactFormInput {
  id: string;
  avatarUrl?: string;
  lastInteraction?: string;
}

type ViewMode = 'list' | 'card';


function ContactForm({ contact, onFormSubmit, closeDialog }: { contact?: AppContact, onFormSubmit: (data: ContactFormInput) => Promise<void>, closeDialog: () => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<ContactFormInput>({
    resolver: zodResolver(ContactSchema),
    defaultValues: contact || {
      name: '',
      email: '',
      phone: '',
      type: undefined,
      company: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nombre Completo</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
      </div>
      <div>
        <Label htmlFor="email">Correo Electrónico</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <Label htmlFor="phone">Teléfono</Label>
        <Input id="phone" type="tel" {...register("phone")} />
        {errors.phone && <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>}
      </div>
      <div>
        <Label htmlFor="type">Tipo de Contacto</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cliente">Cliente</SelectItem>
                <SelectItem value="Proveedor">Proveedor</SelectItem>
                <SelectItem value="Prospecto">Prospecto</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
      </div>
      <div>
        <Label htmlFor="company">Empresa (Opcional)</Label>
        <Input id="company" {...register("company")} />
        {errors.company && <p className="text-sm text-destructive mt-1">{errors.company.message}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog} disabled={isSubmitting}>Cancelar</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (contact ? "Guardando..." : "Añadiendo...") : (contact ? "Guardar Cambios" : "Añadir Contacto")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ContactCardView({ contact, onEdit, onDelete }: { contact: AppContact, onEdit: (contact: AppContact) => void, onDelete: (contactId: string) => void}) {
    return (
        <Card className="shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <Image src={contact.avatarUrl || `https://placehold.co/60x60.png?text=${contact.name.substring(0,1)}`} alt={contact.name} width={60} height={60} className="rounded-full border" data-ai-hint="persona avatar"/>
                <div className="flex-1">
                    <CardTitle className="text-xl">{contact.name}</CardTitle>
                    <Badge variant={contact.type === "Cliente" ? "default" : contact.type === "Proveedor" ? "secondary" : "outline"}
                        className={`mt-1 text-xs ${
                          contact.type === "Cliente" ? "bg-blue-500/20 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 border-blue-500/30" :
                          contact.type === "Proveedor" ? "bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30" :
                          "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 border-yellow-500/30"
                        }`}
                      >
                        {contact.type === "Cliente" && <UserCheck className="mr-1 h-3 w-3" />}
                        {contact.type === "Proveedor" && <Building className="mr-1 h-3 w-3" />}
                        {contact.type === "Prospecto" && <UserCheck className="mr-1 h-3 w-3 opacity-70" />}
                        {contact.type}
                    </Badge>
                    {contact.company && <p className="text-sm text-muted-foreground mt-1">{contact.company}</p>}
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(contact)}><Edit className="mr-2 h-4 w-4" /> Ver/Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete(contact.id!)} className="text-destructive dark:text-destructive-foreground focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /><Link href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</Link></div>
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><Link href={`tel:${contact.phone}`} className="text-primary hover:underline">{contact.phone}</Link></div>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
                Última interacción: {contact.lastInteraction || "N/A"}
            </CardFooter>
        </Card>
    );
}


export default function ContactsPage() {
  const [contacts, setContacts] = useState<AppContact[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<AppContact | undefined>(undefined);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshContacts = async () => {
    const serverContacts = await getContacts();
    setContacts(serverContacts.map(c => ({...c, id: c.id!, avatarUrl: `https://placehold.co/40x40.png?text=${c.name.substring(0,2).toUpperCase()}`, lastInteraction: "N/A" })));
  };

  useEffect(() => {
    refreshContacts();
  }, []);


  const handleAddSubmit = async (data: ContactFormInput) => {
    const response = await addContact(data);
    if (response.success && response.contact) {
      toast({ title: "Éxito", description: response.message });
      refreshContacts();
      setIsAddDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo añadir el contacto.", errors: response.errors });
    }
  };

  const handleEditSubmit = async (data: ContactFormInput) => {
    if (!editingContact?.id) return;
    const response = await updateContact({ ...data, id: editingContact.id });
    if (response.success && response.contact) {
      toast({ title: "Éxito", description: response.message });
      refreshContacts();
      setIsEditDialogOpen(false);
      setEditingContact(undefined);
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo actualizar el contacto.", errors: response.errors });
    }
  };

  const handleDeleteAction = (contactId: string) => {
    setDeletingContactId(contactId);
  }

  const handleDeleteConfirm = async () => {
    if (!deletingContactId) return;
    const response = await deleteContact(deletingContactId);
    if (response.success) {
      toast({ title: "Éxito", description: response.message });
      refreshContacts();
    } else {
      toast({ variant: "destructive", title: "Error", description: response.message || "No se pudo eliminar el contacto." });
    }
    setDeletingContactId(null); 
  };

  const openEditDialog = (contact: AppContact) => {
    setEditingContact(contact);
    setIsEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-3xl font-bold">Gestión de Contactos</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Gestiona y almacena todos los contactos de tu organización.
                </CardDescription>
              </div>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" onClick={() => setIsAddDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Contacto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Añadir Nuevo Contacto</DialogTitle>
                  <DialogDescription>
                    Completa los detalles para añadir un nuevo contacto.
                  </DialogDescription>
                </DialogHeader>
                <ContactForm onFormSubmit={handleAddSubmit} closeDialog={() => setIsAddDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar contactos..." className="pl-10 w-full" />
            </div>
            <Button variant="outline" className="hidden md:flex">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
             <div className="flex items-center gap-1">
                <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('list')} aria-label="Vista de lista">
                    <List className="h-5 w-5" />
                </Button>
                <Button variant={viewMode === 'card' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('card')} aria-label="Vista de tarjetas">
                    <LayoutGrid className="h-5 w-5" />
                </Button>
            </div>
          </div>

          {viewMode === 'list' && (
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[80px]">Avatar</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo Electrónico</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Última Interacción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                        <TableCell>
                        <Image src={contact.avatarUrl || `https://placehold.co/40x40.png?text=${contact.name.substring(0,1)}`} alt={contact.name} width={40} height={40} className="rounded-full" data-ai-hint="persona avatar"/>
                        </TableCell>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell><Link href={`mailto:${contact.email}`} className="text-primary hover:underline flex items-center gap-1"><Mail className="h-4 w-4"/> {contact.email}</Link></TableCell>
                        <TableCell><Link href={`tel:${contact.phone}`} className="text-primary hover:underline flex items-center gap-1"><Phone className="h-4 w-4"/> {contact.phone}</Link></TableCell>
                        <TableCell>
                        <Badge variant={contact.type === "Cliente" ? "default" : contact.type === "Proveedor" ? "secondary" : "outline"}
                            className={
                            contact.type === "Cliente" ? "bg-blue-500/20 text-blue-700 dark:bg-blue-700/30 dark:text-blue-300 border-blue-500/30" :
                            contact.type === "Proveedor" ? "bg-green-500/20 text-green-700 dark:bg-green-700/30 dark:text-green-300 border-green-500/30" :
                            "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 border-yellow-500/30"
                            }
                        >
                            {contact.type === "Cliente" && <UserCheck className="mr-1 h-3 w-3" />}
                            {contact.type === "Proveedor" && <Building className="mr-1 h-3 w-3" />}
                            {contact.type === "Prospecto" && <UserCheck className="mr-1 h-3 w-3 opacity-70" />}
                            {contact.type}
                        </Badge>
                        </TableCell>
                        <TableCell>{contact.company || "N/D"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{contact.lastInteraction || "N/A"}</TableCell>
                        <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-5 w-5" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(contact)}>
                                <Edit className="mr-2 h-4 w-4" /> Ver/Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Mail className="mr-2 h-4 w-4" /> Enviar Correo
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => handleDeleteAction(contact.id!)}
                                className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
          )}
          {viewMode === 'card' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {contacts.map(contact => (
                    <ContactCardView key={contact.id} contact={contact} onEdit={openEditDialog} onDelete={handleDeleteAction} />
                ))}
            </div>
          )}

          {contacts.length === 0 && (
             <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                <p className="text-muted-foreground">No se encontraron contactos. ¡Añade tu primer contacto!</p>
             </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Mostrando {contacts.length} de {contacts.length} contactos.</p>
          {/* Pagination placeholder */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>Anterior</Button>
            <Button variant="outline" size="sm" disabled>Siguiente</Button>
          </div>
        </CardFooter>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={(isOpen) => { setIsEditDialogOpen(isOpen); if (!isOpen) setEditingContact(undefined);}}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Contacto</DialogTitle>
            <DialogDescription>
              Actualiza los detalles del contacto.
            </DialogDescription>
          </DialogHeader>
          {editingContact && <ContactForm contact={editingContact} onFormSubmit={handleEditSubmit} closeDialog={() => {setIsEditDialogOpen(false); setEditingContact(undefined);}} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingContactId} onOpenChange={(isOpen) => { if(!isOpen) setDeletingContactId(null);}}>
          <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                <AlertDialogDescription>
                    Esta acción no se puede deshacer. Esto eliminará permanentemente el contacto {contacts.find(c=>c.id === deletingContactId)?.name}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingContactId(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
