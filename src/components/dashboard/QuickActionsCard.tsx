import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Receipt, CreditCard, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function QuickActionsCard() {
  const navigate = useNavigate();

  const actions = [
    { 
      label: "Add Transaction", 
      icon: Receipt, 
      onClick: () => navigate("/transactions"),
      variant: "default" as const
    },
    { 
      label: "Add Bill", 
      icon: Plus, 
      onClick: () => navigate("/bills"),
      variant: "secondary" as const
    },
    { 
      label: "Log Grocery Shop", 
      icon: ShoppingCart, 
      onClick: () => navigate("/groceries"),
      variant: "secondary" as const
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              className="w-full justify-start gap-2"
              onClick={action.onClick}
            >
              <action.icon className="h-4 w-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
