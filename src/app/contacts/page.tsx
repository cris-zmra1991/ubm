
"use client";

import type { SVGProps } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users, PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, Mail, Phone, Building, UserCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: "Cliente" | "Proveedor" | "Prospecto";
  company?: string;
  avatarUrl: string;
  lastInteraction: string;
}

const contactsData: Contact[] = [
  { id: "1", name: "Alice Wonderland", email: "alice@example.com", phone: "555-1234", type: "Cliente", company: "Wonderland Inc.", avatarUrl: "https://placehold.co/40x40.png?text=AW", lastInteraction: "Hace 2 días" },
  { id: "2", name: "Bob The Builder", email: "bob@example.com", phone: "555-5678", type: "Proveedor", company: "BuildIt Co.", avatarUrl: "https://placehold.co/40x40.png?text=BB", lastInteraction: "Hace 1 semana" },
  { id: "3", name: "Charlie Brown", email: "charlie@example.com", phone: "555-8765", type: "Prospecto", avatarUrl: "https://placehold.co/40x40.png?text=CB", lastInteraction: "Hace 5 horas" },
  { id: "4", name: "Diana Prince", email: "diana@example.com", phone: "555-4321", type: "Cliente", company: "Themyscira Corp.", avatarUrl: "https://placehold.co/40x40.png?text=DP", lastInteraction: "Ayer" },
];

export default function ContactsPage() {
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
                  Gestiona y almacena todos los contactos de tu organización, incluyendo clientes, proveedores y prospectos.
                </CardDescription>
              </div>
            </div>
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" /> Añadir Nuevo Contacto
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar contactos..." className="pl-10 w-full" />
            </div>
            <Button variant="outline">
              <Filter className="mr-2 h-5 w-5" /> Filtrar
            </Button>
          </div>

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
                {contactsData.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <Image src={contact.avatarUrl} alt={contact.name} width={40} height={40} className="rounded-full" data-ai-hint="person avatar"/>
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
                    <TableCell className="text-muted-foreground text-sm">{contact.lastInteraction}</TableCell>
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
                            <Mail className="mr-2 h-4 w-4" /> Enviar Correo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive dark:text-destructive-foreground dark:focus:bg-destructive/80 focus:bg-destructive/10 focus:text-destructive">
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
          {contactsData.length === 0 && (
             <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
                <p className="text-muted-foreground">No se encontraron contactos. ¡Añade tu primer contacto!</p>
             </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">Mostrando {contactsData.length} de {contactsData.length} contactos.</p>
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
