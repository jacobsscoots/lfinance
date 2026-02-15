import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MedicashBenefitCategory {
  id: string;
  user_id: string;
  name: string;
  yearly_max: number | null;
  is_per_event: boolean;
  per_event_amount: number | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicashClaim {
  id: string;
  user_id: string;
  category_id: string;
  claim_date: string;
  amount: number;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MedicashSettings {
  id: string;
  user_id: string;
  policy_year_start_month: number;
  policy_year_start_day: number;
  plan_level: string;
  plan_type: string;
  created_at: string;
  updated_at: string;
}

// Default Level 3 Solo benefits
const DEFAULT_CATEGORIES = [
  { name: "Dental", yearly_max: 160, icon: "tooth", sort_order: 0 },
  { name: "Optical", yearly_max: 160, icon: "eye", sort_order: 1 },
  { name: "Specialist Consultations", yearly_max: 280, icon: "stethoscope", sort_order: 2 },
  { name: "Diagnostic Tests & Scans", yearly_max: 80, icon: "scan", sort_order: 3 },
  { name: "Complementary Therapies", yearly_max: 360, icon: "heart-pulse", sort_order: 4 },
  { name: "Alternative Therapies", yearly_max: 80, icon: "flower2", sort_order: 5 },
  { name: "Chiropody", yearly_max: 40, icon: "footprints", sort_order: 6 },
  { name: "Hearing Aids", yearly_max: 80, icon: "ear", sort_order: 7 },
  { name: "Inpatient Stay", yearly_max: null, is_per_event: true, per_event_amount: 56, icon: "bed", sort_order: 8 },
  { name: "Hospital Daycase", yearly_max: null, is_per_event: true, per_event_amount: 48, icon: "hospital", sort_order: 9 },
  { name: "Birth of a Child", yearly_max: null, is_per_event: true, per_event_amount: 400, icon: "baby", sort_order: 10 },
];

export function getPolicyYearRange(settings: MedicashSettings | null, referenceDate = new Date()) {
  const startMonth = settings?.policy_year_start_month ?? 1;
  const startDay = settings?.policy_year_start_day ?? 1;
  
  let yearStart = new Date(referenceDate.getFullYear(), startMonth - 1, startDay);
  if (yearStart > referenceDate) {
    yearStart = new Date(referenceDate.getFullYear() - 1, startMonth - 1, startDay);
  }
  const yearEnd = new Date(yearStart.getFullYear() + 1, startMonth - 1, startDay - 1);
  
  return { start: yearStart, end: yearEnd };
}

export function useMedicash() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Settings
  const { data: settings } = useQuery({
    queryKey: ["medicash-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("medicash_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as MedicashSettings | null;
    },
    enabled: !!user,
  });

  // Categories
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["medicash-categories", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("medicash_benefit_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as MedicashBenefitCategory[];
    },
    enabled: !!user,
  });

  // Claims
  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ["medicash-claims", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("medicash_claims")
        .select("*")
        .eq("user_id", user.id)
        .order("claim_date", { ascending: false });
      if (error) throw error;
      return (data || []) as MedicashClaim[];
    },
    enabled: !!user,
  });

  // Seed default categories if none exist
  const seedCategories = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const rows = DEFAULT_CATEGORIES.map(c => ({
        user_id: user.id,
        name: c.name,
        yearly_max: c.yearly_max,
        is_per_event: c.is_per_event || false,
        per_event_amount: (c as any).per_event_amount || null,
        icon: c.icon,
        sort_order: c.sort_order,
      }));
      const { error } = await supabase.from("medicash_benefit_categories").insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicash-categories"] });
    },
  });

  // Create claim
  const createClaim = useMutation({
    mutationFn: async (data: { category_id: string; claim_date: string; amount: number; description?: string; notes?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("medicash_claims").insert({
        user_id: user.id,
        ...data,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicash-claims"] });
      toast.success("Claim logged");
    },
    onError: (e) => toast.error(e.message),
  });

  // Delete claim
  const deleteClaim = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medicash_claims").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicash-claims"] });
      toast.success("Claim deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async (data: { policy_year_start_month: number; policy_year_start_day: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("medicash_settings")
        .upsert({ user_id: user.id, ...data } as any, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicash-settings"] });
      toast.success("Settings updated");
    },
    onError: (e) => toast.error(e.message),
  });

  // Computed: claims within current policy year
  const policyYear = getPolicyYearRange(settings);
  const policyYearClaims = claims.filter(c => {
    const d = new Date(c.claim_date);
    return d >= policyYear.start && d <= policyYear.end;
  });

  // Per-category totals for current policy year
  const categoryTotals = categories.map(cat => {
    const catClaims = policyYearClaims.filter(c => c.category_id === cat.id);
    const totalClaimed = catClaims.reduce((s, c) => s + Number(c.amount), 0);
    const remaining = cat.yearly_max ? Math.max(0, cat.yearly_max - totalClaimed) : null;
    return { ...cat, totalClaimed, remaining, claims: catClaims };
  });

  const totalClaimedThisYear = policyYearClaims.reduce((s, c) => s + Number(c.amount), 0);
  const totalMaxThisYear = categories
    .filter(c => c.yearly_max)
    .reduce((s, c) => s + (c.yearly_max || 0), 0);
  const totalRemainingThisYear = totalMaxThisYear - categoryTotals
    .filter(c => c.yearly_max)
    .reduce((s, c) => s + c.totalClaimed, 0);

  return {
    settings,
    categories,
    claims,
    categoriesLoading,
    claimsLoading,
    categoryTotals,
    policyYear,
    totalClaimedThisYear,
    totalMaxThisYear,
    totalRemainingThisYear: Math.max(0, totalRemainingThisYear),
    seedCategories: seedCategories.mutate,
    isSeeding: seedCategories.isPending,
    createClaim: createClaim.mutate,
    isCreatingClaim: createClaim.isPending,
    deleteClaim: deleteClaim.mutate,
    updateSettings: updateSettings.mutate,
  };
}
