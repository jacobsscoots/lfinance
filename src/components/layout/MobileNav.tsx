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
  PieChart,
  Percent,
  Wallet2,
  LogOut,
  CalendarRange,
  BarChart3,
  Truck,
  Gift,
  HeartPulse
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

const navGroups = [
  {
    label: null,
    items: [{ name: "Dashboard", href: "/", icon: Home }],
  },
  {
    label: "MONEY",
    items: [
      { name: "Accounts", href: "/accounts", icon: CreditCard },
      { name: "Transactions", href: "/transactions", icon: Receipt },
      { name: "Debt Tracker", href: "/debt-tracker", icon: Wallet2 },
    ],
  },
  {
    label: "BILLS",
    items: [
      { name: "Bills", href: "/bills", icon: TrendingUp },
      { name: "Cheaper Bills", href: "/cheaper-bills", icon: Percent },
      { name: "Yearly Planner", href: "/yearly-planner", icon: CalendarRange },
      { name: "Medicash", href: "/medicash", icon: HeartPulse },
    ],
  },
  {
    label: "INVESTMENTS",
    items: [
      { name: "Investments", href: "/investments", icon: PieChart },
      { name: "Net Worth", href: "/net-worth", icon: BarChart3 },
    ],
  },
  {
    label: "LIFESTYLE",
    items: [
      { name: "Shopping", href: "/groceries", icon: ShoppingCart },
      { name: "Meal Plan", href: "/meal-plan", icon: UtensilsCrossed },
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
      { name: "Deliveries", href: "/deliveries", icon: Truck },
      { name: "Birthdays", href: "/birthdays", icon: Gift },
    ],
  },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <div className="lg:hidden">
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">
            Lifehub
          </span>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 bg-sidebar p-0 border-sidebar-border flex flex-col h-full">
            <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border shrink-0">
              <span className="text-lg font-semibold text-sidebar-foreground">Menu</span>
            </div>
            <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto min-h-0">
              {navGroups.map((group, gi) => (
                <div key={gi}>
                  {group.label && (
                    <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                      {group.label}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname === item.href;
                      return (
                        <NavLink
                          key={item.name}
                          to={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.name}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Settings in mobile */}
              <NavLink
                to="/settings"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]",
                  location.pathname === "/settings"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                Settings
              </NavLink>
            </nav>
            {/* Footer - always visible at bottom */}
            <div className="px-4 py-4 border-t border-sidebar-border space-y-2 shrink-0">
              {user && (
                <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">
                  {user.email}
                </div>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 min-h-[44px]"
                onClick={() => {
                  signOut();
                  setOpen(false);
                }}
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-14" />
    </div>
  );
}
