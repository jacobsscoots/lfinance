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
  Sparkles,
  PieChart,
  Percent
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

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
  { name: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

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
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.name}
              to={item.href}
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

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
        {user && (
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">
            {user.email}
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
        <p className="text-xs text-sidebar-foreground/60 px-3">
          © 2026 Life Tracker
        </p>
      </div>
    </aside>
  );
}
