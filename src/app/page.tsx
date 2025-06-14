
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, ShoppingCart, Store, CreditCard, Calculator, Boxes, Settings, DollarSign, UserPlus } from "lucide-react";
import Link from "next/link";
import { getSalesLastMonthValue } from "@/app/actions/sales.actions";
import { getPurchasesLastMonthValue } from "@/app/actions/purchases.actions";
import { getExpensesLastMonthValue } from "@/app/actions/expenses.actions";
import { getNewClientsThisMonthCount } from "@/app/actions/contacts.actions";

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
  { title: "Contactos", description: "Gestiona clientes y proveedores", icon: Users, href: "/contacts", bgColorClass: "bg-blue-100 dark:bg-blue-900", textColorClass: "text-blue-700 dark:text-blue-300", borderColorClass: "border-blue-300 dark:border-blue-700" },
  { title: "Compras", description: "Realiza seguimiento de tus compras", icon: ShoppingCart, href: "/purchases", bgColorClass: "bg-green-100 dark:bg-green-900", textColorClass: "text-green-700 dark:text-green-300", borderColorClass: "border-green-300 dark:border-green-700" },
  { title: "Ventas", description: "Supervisa las operaciones de venta", icon: Store, href: "/sales", bgColorClass: "bg-purple-100 dark:bg-purple-900", textColorClass: "text-purple-700 dark:text-purple-300", borderColorClass: "border-purple-300 dark:border-purple-700" },
  { title: "Gastos", description: "Registra y gestiona gastos", icon: CreditCard, href: "/expenses", bgColorClass: "bg-red-100 dark:bg-red-900", textColorClass: "text-red-700 dark:text-red-300", borderColorClass: "border-red-300 dark:border-red-700" },
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


export default async function DashboardPage() {
  const salesLastMonth = await getSalesLastMonthValue();
  const purchasesLastMonth = await getPurchasesLastMonthValue();
  const expensesLastMonth = await getExpensesLastMonthValue();
  const newClientsThisMonth = await getNewClientsThisMonthCount();

  const metricItems: MetricItem[] = [
    { title: "Ventas del Último Mes", value: `€${salesLastMonth.toFixed(2)}`, icon: DollarSign, iconBgColorClass: "bg-green-100 dark:bg-green-800", iconTextColorClass: "text-green-600 dark:text-green-300" },
    { title: "Compras del Último Mes", value: `€${purchasesLastMonth.toFixed(2)}`, icon: ShoppingCart, iconBgColorClass: "bg-blue-100 dark:bg-blue-800", iconTextColorClass: "text-blue-600 dark:text-blue-300" },
    { title: "Gastos del Último Mes", value: `€${expensesLastMonth.toFixed(2)}`, icon: CreditCard, iconBgColorClass: "bg-red-100 dark:bg-red-800", iconTextColorClass: "text-red-600 dark:text-red-300" },
    { title: "Clientes Nuevos (Últ. Mes)", value: `${newClientsThisMonth}`, icon: UserPlus, iconBgColorClass: "bg-purple-100 dark:bg-purple-800", iconTextColorClass: "text-purple-600 dark:text-purple-300" },
  ];


  return (
    <div className="space-y-8">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">Bienvenido al Gestor Unificado de Negocios</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Tu centro de control para gestionar todos los aspectos de tu negocio. Optimiza tus operaciones y toma decisiones informadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Navega por los módulos usando la barra lateral para gestionar contactos, compras, ventas, gastos, contabilidad, inventario y configuraciones administrativas.
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
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Acceso Rápido</h2>
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
                    Ir a {item.title} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4 text-foreground">Resumen de Módulos Clave</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-md border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Calculator className="h-8 w-8 text-accent" />
                <CardTitle>Contabilidad</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Gestiona registros financieros, genera informes y realiza un seguimiento de la salud financiera de tu negocio.
              </CardDescription>
              <Button variant="link" asChild className="p-0 mt-2 text-primary">
                <Link href="/accounting">Explorar Contabilidad <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="shadow-md border-border">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Boxes className="h-8 w-8 text-accent" />
                <CardTitle>Inventario</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Supervisa los niveles de stock, gestiona la información de productos e integra con ventas y compras.
              </CardDescription>
               <Button variant="link" asChild className="p-0 mt-2 text-primary">
                <Link href="/inventory">Gestionar Inventario <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
