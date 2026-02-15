import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Transactions = lazy(() => import("./pages/Transactions"));
const Bills = lazy(() => import("./pages/Bills"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Groceries = lazy(() => import("./pages/Groceries"));
const MealPlan = lazy(() => import("./pages/MealPlan"));
const Toiletries = lazy(() => import("./pages/Toiletries"));
const Investments = lazy(() => import("./pages/Investments"));
const CheaperBills = lazy(() => import("./pages/CheaperBills"));
const Settings = lazy(() => import("./pages/Settings"));
const DebtTracker = lazy(() => import("./pages/DebtTracker"));
const YearlyPlanner = lazy(() => import("./pages/YearlyPlanner"));
const NetWorth = lazy(() => import("./pages/NetWorth"));
const Deliveries = lazy(() => import("./pages/Deliveries"));
const Birthdays = lazy(() => import("./pages/Birthdays"));
const Medicash = lazy(() => import("./pages/Medicash"));
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/accounts" element={<ProtectedRoute><Accounts /></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
              <Route path="/bills" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
              <Route path="/investments" element={<ProtectedRoute><Investments /></ProtectedRoute>} />
              <Route path="/cheaper-bills" element={<ProtectedRoute><CheaperBills /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/groceries" element={<ProtectedRoute><Groceries /></ProtectedRoute>} />
              <Route path="/meal-plan" element={<ProtectedRoute><MealPlan /></ProtectedRoute>} />
              <Route path="/toiletries" element={<ProtectedRoute><Toiletries /></ProtectedRoute>} />
              <Route path="/debt-tracker" element={<ProtectedRoute><DebtTracker /></ProtectedRoute>} />
              <Route path="/yearly-planner" element={<ProtectedRoute><YearlyPlanner /></ProtectedRoute>} />
              <Route path="/net-worth" element={<ProtectedRoute><NetWorth /></ProtectedRoute>} />
              <Route path="/deliveries" element={<ProtectedRoute><Deliveries /></ProtectedRoute>} />
              <Route path="/birthdays" element={<ProtectedRoute><Birthdays /></ProtectedRoute>} />
              <Route path="/medicash" element={<ProtectedRoute><Medicash /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
