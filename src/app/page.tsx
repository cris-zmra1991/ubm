import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, ShoppingCart, Store, CreditCard, Calculator, Boxes, Settings, DollarSign, UserPlus } from "lucide-react";
import Link from "next/link";

interface QuickAccessItem {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  bgColorClass: string;
  textColorClass: string;
  borderColorClass: string;
}

const quickAccessItems: QuickAccessItem[] = [
  { title: "Contacts", description: "Manage clients & providers", icon: Users, href: "/contacts", bgColorClass: "bg-blue-100 dark:bg-blue-900", textColorClass: "text-blue-700 dark:text-blue-300", borderColorClass: "border-blue-300 dark:border-blue-700" },
  { title: "Purchases", description: "Track your purchases", icon: ShoppingCart, href: "/purchases", bgColorClass: "bg-green-100 dark:bg-green-900", textColorClass: "text-green-700 dark:text-green-300", borderColorClass: "border-green-300 dark:border-green-700" },
  { title: "Sales", description: "Oversee sales operations", icon: Store, href: "/sales", bgColorClass: "bg-purple-100 dark:bg-purple-900", textColorClass: "text-purple-700 dark:text-purple-300", borderColorClass: "border-purple-300 dark:border-purple-700" },
  { title: "Expenses", description: "Record and manage expenses", icon: CreditCard, href: "/expenses", bgColorClass: "bg-red-100 dark:bg-red-900", textColorClass: "text-red-700 dark:text-red-300", borderColorClass: "border-red-300 dark:border-red-700" },
];

interface MetricItem {
  title: string;
  value: string;
  icon: React.ElementType;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  iconBgColorClass: string;
  iconTextColorClass: string;
}

const metricItems: MetricItem[] = [
  { title: "Last Month's Sales", value: "€12,345", icon: DollarSign, change: "+10.2%", changeType: 'positive', iconBgColorClass: "bg-green-100 dark:bg-green-800", iconTextColorClass: "text-green-600 dark:text-green-300" },
  { title: "Last Month's Purchases", value: "€5,678", icon: ShoppingCart, change: "+3.1%", changeType: 'positive', iconBgColorClass: "bg-blue-100 dark:bg-blue-800", iconTextColorClass: "text-blue-600 dark:text-blue-300" },
  { title: "Last Month's Expenses", value: "€1,234", icon: CreditCard, change: "-2.5%", changeType: 'negative', iconBgColorClass: "bg-red-100 dark:bg-red-800", iconTextColorClass: "text-red-600 dark:text-red-300" },
  { title: "New Customers", value: "15", icon: UserPlus, change: "+8 this month", changeType: 'positive', iconBgColorClass: "bg-purple-100 dark:bg-purple-800", iconTextColorClass: "text-purple-600 dark:text-purple-300" },
];


export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Welcome to Unified Business Manager</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Your central hub for managing all aspects of your business. Streamline your operations and make informed decisions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Navigate through modules using the sidebar to manage contacts, purchases, sales, expenses, accounting, inventory, and administrative settings.
          </p>
        </CardContent>
      </Card>

      <section>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {metricItems.map((item) => (
            <Card key={item.title} className="shadow-md hover:shadow-lg transition-shadow duration-300 border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{item.title}</CardTitle>
                <div className={`p-2 rounded-md ${item.iconBgColorClass}`}>
                  <item.icon className={`h-5 w-5 ${item.iconTextColorClass}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{item.value}</div>
                {item.change && (
                  <p className={`text-xs mt-1 ${
                    item.changeType === 'positive' ? 'text-accent' :
                    item.changeType === 'negative' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {item.change}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Quick Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickAccessItems.map((item) => (
            <Card key={item.title} className={`shadow-md hover:shadow-xl transition-shadow duration-300 border ${item.borderColorClass} ${item.bgColorClass}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={`text-lg font-medium ${item.textColorClass}`}>{item.title}</CardTitle>
                <item.icon className={`h-6 w-6 ${item.textColorClass} opacity-80`} />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                <Button variant="outline" size="sm" asChild className="border-primary/50 text-primary hover:bg-primary/10">
                  <Link href={item.href}>
                    Go to {item.title} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Key Modules Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-md border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Calculator className="h-8 w-8 text-accent" />
                <CardTitle>Accounting</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Manage financial records, generate reports, and keep track of your business's financial health.
              </CardDescription>
              <Button variant="link" asChild className="p-0 mt-2 text-primary">
                <Link href="/accounting">Explore Accounting <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-md border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Boxes className="h-8 w-8 text-accent" />
                <CardTitle>Inventory</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Oversee stock levels, manage product information, and integrate with sales and purchases.
              </CardDescription>
               <Button variant="link" asChild className="p-0 mt-2 text-primary">
                <Link href="/inventory">Manage Inventory <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
