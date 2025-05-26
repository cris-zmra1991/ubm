
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calculator, PlusCircle, Search, Filter, FileText, DollarSign, TrendingUp, TrendingDown, BarChart3, Landmark, FilePenLine } from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import type { ChartConfig } from "@/components/ui/chart"

const chartData = [
  { month: "January", revenue: 1860, expenses: 800 },
  { month: "February", revenue: 3050, expenses: 1200 },
  { month: "March", revenue: 2370, expenses: 950 },
  { month: "April", revenue: 730, expenses: 1100 },
  { month: "May", revenue: 2090, expenses: 850 },
  { month: "June", revenue: 2140, expenses: 920 },
]

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

interface Account {
  id: string;
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  balance: number;
}
const chartOfAccountsData: Account[] = [
  { id: "1", code: "1010", name: "Cash", type: "Asset", balance: 25000.75 },
  { id: "2", code: "1200", name: "Accounts Receivable", type: "Asset", balance: 12500.00 },
  { id: "3", code: "2010", name: "Accounts Payable", type: "Liability", balance: 8750.50 },
  { id: "4", code: "3010", name: "Owner's Equity", type: "Equity", balance: 50000.00 },
  { id: "5", code: "4010", name: "Sales Revenue", type: "Revenue", balance: 75000.25 },
  { id: "6", code: "5010", name: "Office Expenses", type: "Expense", balance: 5250.00 },
];

interface JournalEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
}
const journalEntriesData: JournalEntry[] = [
 { id: "1", date: "2024-07-01", entryNumber: "JE-001", description: "Cash sale", debitAccount: "1010 Cash", creditAccount: "4010 Sales Revenue", amount: 500.00 },
 { id: "2", date: "2024-07-02", entryNumber: "JE-002", description: "Paid office rent", debitAccount: "5010 Office Expenses", creditAccount: "1010 Cash", amount: 1200.00 },
];

export default function AccountingPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Calculator className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-3xl font-bold">Accounting</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Manage financial records, generate reports, and track overall financial health.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="chartOfAccounts">Chart of Accounts</TabsTrigger>
              <TabsTrigger value="journalEntries">Journal Entries</TabsTrigger>
              <TabsTrigger value="reports">Financial Reports</TabsTrigger>
              <TabsTrigger value="reconciliation">Bank Reconciliation</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue (YTD)</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">€125,670.50</div>
                    <p className="text-xs text-muted-foreground">+15.2% from last year</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses (YTD)</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">€45,320.80</div>
                    <p className="text-xs text-muted-foreground">+8.1% from last year</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Profit (YTD)</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">€80,349.70</div>
                    <p className="text-xs text-muted-foreground" style={{color: 'hsl(var(--accent))'}}>+20.5% from last year</p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Revenue vs Expenses Overview</CardTitle>
                  <CardDescription>Last 6 months performance</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `€${value/1000}k`} />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chartOfAccounts" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Chart of Accounts</h3>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> Add Account</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartOfAccountsData.map(acc => (
                      <TableRow key={acc.id}>
                        <TableCell>{acc.code}</TableCell>
                        <TableCell className="font-medium">{acc.name}</TableCell>
                        <TableCell>{acc.type}</TableCell>
                        <TableCell className="text-right">€{acc.balance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="journalEntries" className="mt-6">
               <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Journal Entries</h3>
                <Button><PlusCircle className="mr-2 h-4 w-4"/> New Journal Entry</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Entry #</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Debit Account</TableHead>
                      <TableHead>Credit Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journalEntriesData.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.date}</TableCell>
                        <TableCell>{entry.entryNumber}</TableCell>
                        <TableCell className="font-medium">{entry.description}</TableCell>
                        <TableCell>{entry.debitAccount}</TableCell>
                        <TableCell>{entry.creditAccount}</TableCell>
                        <TableCell className="text-right">€{entry.amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-6 space-y-4">
              <h3 className="text-xl font-semibold">Financial Reports</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">Balance Sheet</p>
                    <p className="text-xs text-muted-foreground text-left">View assets, liabilities, and equity.</p>
                  </div>
                </Button>
                <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">Income Statement</p>
                    <p className="text-xs text-muted-foreground text-left">Analyze revenues and expenses.</p>
                  </div>
                </Button>
                <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">Cash Flow Statement</p>
                    <p className="text-xs text-muted-foreground text-left">Track cash inflows and outflows.</p>
                  </div>
                </Button>
                 <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">Trial Balance</p>
                    <p className="text-xs text-muted-foreground text-left">Verify debit and credit balances.</p>
                  </div>
                </Button>
                 <Button variant="outline" size="lg" className="justify-start h-auto py-4">
                  <FileText className="mr-3 h-6 w-6 text-primary" /> 
                  <div>
                    <p className="font-semibold">General Ledger</p>
                    <p className="text-xs text-muted-foreground text-left">View detailed transaction history.</p>
                  </div>
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="reconciliation" className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Bank Reconciliation</h3>
                 <Button><Landmark className="mr-2 h-4 w-4"/> Start New Reconciliation</Button>
              </div>
              <div className="min-h-[200px] flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20 p-8 text-center">
                <div>
                  <Landmark className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Bank reconciliation features will be implemented here.</p>
                  <p className="text-xs text-muted-foreground mt-1">Connect bank accounts, match transactions, and ensure your records are accurate.</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
