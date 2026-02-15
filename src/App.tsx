import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Bills from "./pages/Bills";
import Calendar from "./pages/Calendar";
import Groceries from "./pages/Groceries";
import MealPlan from "./pages/MealPlan";
import Toiletries from "./pages/Toiletries";
import Investments from "./pages/Investments";
import CheaperBills from "./pages/CheaperBills";
import Settings from "./pages/Settings";
import DebtTracker from "./pages/DebtTracker";
import YearlyPlanner from "./pages/YearlyPlanner";
import NetWorth from "./pages/NetWorth";
import Deliveries from "./pages/Deliveries";
import Birthdays from "./pages/Birthdays";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
            <Route path="/toiletries" element={<ProtectedRoute><Groceries /></ProtectedRoute>} />
            <Route path="/debt-tracker" element={<ProtectedRoute><DebtTracker /></ProtectedRoute>} />
            <Route path="/yearly-planner" element={<ProtectedRoute><YearlyPlanner /></ProtectedRoute>} />
            <Route path="/net-worth" element={<ProtectedRoute><NetWorth /></ProtectedRoute>} />
            <Route path="/deliveries" element={<ProtectedRoute><Deliveries /></ProtectedRoute>} />
            <Route path="/birthdays" element={<ProtectedRoute><Birthdays /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
