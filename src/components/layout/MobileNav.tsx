import { useState } from "react";
import { 
  Home, 
  CreditCard, 
  Receipt, 
  CalendarDays, 
  ShoppingCart, 
  UtensilsCrossed,
  Settings,
  TrendingUp,
  Menu,
  X,
  Sparkles,
  PieChart,
  Percent,
  Wallet2
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Accounts", href: "/accounts", icon: CreditCard },
  { name: "Transactions", href: "/transactions", icon: Receipt },
  { name: "Bills", href: "/bills", icon: TrendingUp },
  { name: "Cheaper Bills", href: "/cheaper-bills", icon: Percent },
  { name: "Investments", href: "/investments", icon: PieChart },
  { name: "Calendar", href: "/calendar", icon: CalendarDays },
  { name: "Groceries", href: "/groceries", icon: ShoppingCart },
  { name: "Meal Plan", href: "/meal-plan", icon: UtensilsCrossed },
  { name: "Toiletries", href: "/toiletries", icon: Sparkles },
  { name: "Debt Tracker", href: "/debt-tracker", icon: Wallet2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="lg:hidden">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">
            Life Tracker
          </span>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 bg-sidebar p-0 border-sidebar-border">
            <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
              <span className="text-lg font-semibold text-sidebar-foreground">Menu</span>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />
    </div>
  );
}
