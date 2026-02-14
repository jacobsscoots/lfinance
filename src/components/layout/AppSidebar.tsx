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
  LogOut,
  PieChart,
  Percent,
  Wallet2,
  CalendarRange,
  BarChart3,
  Truck,
  Gift
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AccountSettingsDialog } from "@/components/settings/AccountSettingsDialog";

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
      { name: "Calendar", href: "/calendar", icon: CalendarDays },
      { name: "Deliveries", href: "/deliveries", icon: Truck },
      { name: "Birthdays", href: "/birthdays", icon: Gift },
      { name: "Groceries", href: "/groceries", icon: ShoppingCart },
      { name: "Meal Plan", href: "/meal-plan", icon: UtensilsCrossed },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <span className="text-xl font-semibold text-sidebar-foreground">
            Life Tracker
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto scrollbar-hide">
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
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            location.pathname === "/settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
        {user && (
          <button
            onClick={() => setAccountOpen(true)}
            className="px-3 py-1 text-xs text-sidebar-foreground/50 truncate w-full text-left hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-lg transition-colors cursor-pointer"
          >
            {user.email}
          </button>
        )}
        <AccountSettingsDialog open={accountOpen} onOpenChange={setAccountOpen} />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 h-9"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
