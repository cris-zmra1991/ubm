
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Settings as SettingsIcon, PlusCircle, Users, Building, SlidersHorizontal, MoreHorizontal, Edit, Trash2, ShieldCheck, KeyRound, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface User {
  id: string;
  username: string;
  email: string;
  role: "Admin" | "Manager" | "User";
  status: "Active" | "Inactive";
  lastLogin: string;
}

const usersData: User[] = [
  { id: "1", username: "johndoe", email: "john.doe@example.com", role: "Admin", status: "Active", lastLogin: "2024-07-22 10:00 AM" },
  { id: "2", username: "janesmith", email: "jane.smith@example.com", role: "Manager", status: "Active", lastLogin: "2024-07-21 03:00 PM" },
  { id: "3", username: "bobbuilder", email: "bob.builder@example.com", role: "User", status: "Inactive", lastLogin: "2024-06-15 09:00 AM" },
];


export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <SettingsIcon className="h-8 w-8 text-primary" />
            <div>
                <CardTitle className="text-3xl font-bold">Admin Configuration</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                Manage application-wide settings, users, and system configurations.
                </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6">
              <TabsTrigger value="general"><Building className="mr-2 h-4 w-4" />General Settings</TabsTrigger>
              <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />User Management</TabsTrigger>
              <TabsTrigger value="security"><ShieldCheck className="mr-2 h-4 w-4" />Security</TabsTrigger>
              <TabsTrigger value="notifications"><Bell className="mr-2 h-4 w-4" />Notifications</TabsTrigger>
              <TabsTrigger value="integrations"><SlidersHorizontal className="mr-2 h-4 w-4" />Integrations</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>Set up your organization's details.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input id="companyName" defaultValue="Unified Business Solutions" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="companyEmail">Company Email</Label>
                      <Input id="companyEmail" type="email" defaultValue="contact@ubm.com" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                      <Label htmlFor="companyAddress">Company Address</Label>
                      <Input id="companyAddress" defaultValue="123 Main Street, Business City, BC 12345" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                      <Label htmlFor="currency">Default Currency</Label>
                      <Select defaultValue="EUR">
                        <SelectTrigger id="currency">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EUR">Euro (€)</SelectItem>
                          <SelectItem value="USD">US Dollar ($)</SelectItem>
                          <SelectItem value="GBP">British Pound (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select defaultValue="Europe/Paris">
                            <SelectTrigger id="timezone">
                            <SelectValue placeholder="Select timezone" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Europe/Paris">Europe/Paris (GMT+2)</SelectItem>
                                <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                                <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                    <Button>Save General Settings</Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold">Manage Users</h3>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Add New User</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersData.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === "Active" ? "default" : "outline"}
                            className={user.status === "Active" ? "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30" : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"}
                          >
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.lastLogin}</TableCell>
                        <TableCell className="text-right">
                           <Button variant="ghost" size="sm"><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            
            <TabsContent value="security" className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Security Settings</CardTitle>
                        <CardDescription>Configure security policies and access controls.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="mfa" className="font-semibold">Two-Factor Authentication (2FA)</Label>
                                <p className="text-sm text-muted-foreground">Require 2FA for all users.</p>
                            </div>
                            <Switch id="mfa" />
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="passwordPolicy">Password Policy</Label>
                            <Select defaultValue="medium">
                                <SelectTrigger id="passwordPolicy">
                                <SelectValue placeholder="Select password policy" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="simple">Simple (Min. 8 characters)</SelectItem>
                                    <SelectItem value="medium">Medium (Min. 10 chars, 1 number, 1 special)</SelectItem>
                                    <SelectItem value="strong">Strong (Min. 12 chars, 1 upper, 1 lower, 1 number, 1 special)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-1.5">
                            <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                            <Input id="sessionTimeout" type="number" defaultValue="30" />
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button>Save Security Settings</Button>
                    </CardFooter>
                </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Notification Settings</CardTitle>
                        <CardDescription>Manage how and when notifications are sent.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="emailNotifications" className="font-semibold">Email Notifications</Label>
                                <p className="text-sm text-muted-foreground">Enable or disable system-wide email notifications.</p>
                            </div>
                            <Switch id="emailNotifications" defaultChecked />
                        </div>
                         <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="newSaleNotify" className="font-semibold">New Sale Notification</Label>
                                <p className="text-sm text-muted-foreground">Notify admins on new sales.</p>
                            </div>
                            <Switch id="newSaleNotify" defaultChecked />
                        </div>
                         <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                                <Label htmlFor="lowStockNotify" className="font-semibold">Low Stock Alerts</Label>
                                <p className="text-sm text-muted-foreground">Send alerts for low inventory items.</p>
                            </div>
                            <Switch id="lowStockNotify" defaultChecked />
                        </div>
                    </CardContent>
                     <CardFooter>
                        <Button>Save Notification Settings</Button>
                    </CardFooter>
                </Card>
            </TabsContent>

            <TabsContent value="integrations">
                <Card>
                    <CardHeader>
                        <CardTitle>Integrations & API</CardTitle>
                        <CardDescription>Connect with other services and manage API keys.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-6 border-2 border-dashed border-border rounded-lg bg-muted/20 text-center">
                            <KeyRound className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">API key management and third-party integrations will appear here.</p>
                            <p className="text-xs text-muted-foreground mt-1">For example: payment gateways, email marketing services, etc.</p>
                             <Button variant="secondary" className="mt-4">Manage API Keys</Button>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
