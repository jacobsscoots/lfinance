import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { MobileNav } from "./MobileNav";
import { OfflineIndicator } from "./OfflineIndicator";
import { useBackgroundSync } from "@/hooks/useBackgroundSync";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Runs silent background syncs for smart meter, Gmail, etc. every 5 minutes
  useBackgroundSync();

  return (
    <div className="min-h-screen bg-background">
      <OfflineIndicator />
      <AppSidebar />
      <MobileNav />
      
      {/* Main Content */}
      <main className="lg:pl-64 min-w-0">
        <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 min-w-0 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
