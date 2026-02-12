import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface BirthdayEvent {
  id: string;
  user_id: string;
  person_name: string;
  occasion: string;
  event_month: number;
  event_day: number | null;
  budget: number;
  notes: string | null;
  is_active: boolean;
  title: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  money_scheduled: boolean | null;
  card_sent: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface BirthdayExpense {
  id: string;
  user_id: string;
  event_id: string;
  description: string;
  amount: number;
  year: number;
  is_purchased: boolean;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useBirthdayEvents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["birthday-events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("birthday_events")
        .select("*")
        .eq("user_id", user.id)
        .order("event_month", { ascending: true })
        .order("event_day", { ascending: true });
      if (error) throw error;
      return data as BirthdayEvent[];
    },
    enabled: !!user,
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ["birthday-expenses", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("birthday_expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as BirthdayExpense[];
    },
    enabled: !!user,
  });

  const addEvent = useMutation({
    mutationFn: async (input: Partial<BirthdayEvent>) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("birthday_events")
        .insert([{ user_id: user.id, ...input } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-events"] });
      toast.success("Event added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, ...input }: Partial<BirthdayEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from("birthday_events")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-events"] });
      toast.success("Event updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("birthday_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-events"] });
      queryClient.invalidateQueries({ queryKey: ["birthday-expenses"] });
      toast.success("Event deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const addExpense = useMutation({
    mutationFn: async (input: Partial<BirthdayExpense>) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("birthday_expenses")
        .insert([{ user_id: user.id, ...input } as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-expenses"] });
      toast.success("Expense added");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...input }: Partial<BirthdayExpense> & { id: string }) => {
      const { data, error } = await supabase
        .from("birthday_expenses")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-expenses"] });
      toast.success("Expense updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("birthday_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-expenses"] });
      toast.success("Expense deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const importEvents = useMutation({
    mutationFn: async (rows: Array<{
      person_name: string;
      occasion: string;
      event_month: number;
      event_day: number | null;
      budget: number;
      title?: string | null;
      address_line1?: string | null;
      address_line2?: string | null;
      city?: string | null;
      state?: string | null;
      postcode?: string | null;
      country?: string | null;
      money_scheduled?: boolean | null;
      card_sent?: boolean | null;
      expenses?: Array<{ description: string; amount: number; year: number }>;
    }>) => {
      if (!user) throw new Error("Not authenticated");
      
      for (const row of rows) {
        const { expenses: rowExpenses, ...eventData } = row;
        const { data: event, error } = await supabase
          .from("birthday_events")
          .insert({ user_id: user.id, ...eventData })
          .select()
          .single();
        if (error) throw error;

        if (rowExpenses?.length && event) {
          const expenseRows = rowExpenses.map(e => ({
            user_id: user.id,
            event_id: event.id,
            ...e,
          }));
          const { error: expError } = await supabase
            .from("birthday_expenses")
            .insert(expenseRows);
          if (expError) throw expError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["birthday-events"] });
      queryClient.invalidateQueries({ queryKey: ["birthday-expenses"] });
      toast.success("Import complete");
    },
    onError: (e) => toast.error(`Import failed: ${e.message}`),
  });

  return {
    events,
    expenses,
    isLoading: isLoading || expensesLoading,
    addEvent,
    updateEvent,
    deleteEvent,
    addExpense,
    updateExpense,
    deleteExpense,
    importEvents,
  };
}
