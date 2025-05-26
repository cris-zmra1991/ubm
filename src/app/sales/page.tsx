import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Store } from "lucide-react";

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold">Sales Management</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Manage sales, including draft (budget) and confirmed stages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="min-h-[300px] flex items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20">
            <p className="text-muted-foreground">Sales management features will be implemented here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
