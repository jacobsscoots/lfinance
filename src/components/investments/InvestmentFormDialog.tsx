import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RISK_PRESETS } from "@/lib/investmentCalculations";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  provider: z.string().optional(),
  fund_type: z.string().optional(),
  ticker_symbol: z.string().optional(),
  start_date: z.date({ required_error: "Start date is required" }),
  expected_annual_return: z.coerce.number().min(0).max(100),
  risk_preset: z.string().optional(),
  initial_deposit: z.coerce.number().min(0).optional(),
  recurring_amount: z.coerce.number().min(0).optional(),
  recurring_frequency: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface InvestmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormValues) => void;
  isLoading?: boolean;
  defaultValues?: Partial<FormValues>;
  mode?: "create" | "edit";
}

export function InvestmentFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  defaultValues,
  mode = "create",
}: InvestmentFormDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: defaultValues?.name || "ChipX AI Fund",
      provider: defaultValues?.provider || "Chip",
      fund_type: defaultValues?.fund_type || "fund",
      ticker_symbol: defaultValues?.ticker_symbol || "",
      start_date: defaultValues?.start_date || new Date(),
      expected_annual_return: defaultValues?.expected_annual_return ?? 8,
      risk_preset: defaultValues?.risk_preset || "medium",
      initial_deposit: defaultValues?.initial_deposit,
      recurring_amount: defaultValues?.recurring_amount,
      recurring_frequency: defaultValues?.recurring_frequency || "monthly",
      notes: defaultValues?.notes || "",
    },
  });

  // Reset form when defaultValues change (for edit mode)
  useEffect(() => {
    if (open && defaultValues) {
      form.reset({
        name: defaultValues.name || "ChipX AI Fund",
        provider: defaultValues.provider || "Chip",
        fund_type: defaultValues.fund_type || "fund",
        ticker_symbol: defaultValues.ticker_symbol || "",
        start_date: defaultValues.start_date || new Date(),
        expected_annual_return: defaultValues.expected_annual_return ?? 8,
        risk_preset: defaultValues.risk_preset || "medium",
        initial_deposit: defaultValues.initial_deposit,
        recurring_amount: defaultValues.recurring_amount,
        recurring_frequency: defaultValues.recurring_frequency || "monthly",
        notes: defaultValues.notes || "",
      });
    } else if (open && !defaultValues) {
      form.reset({
        name: "ChipX AI Fund",
        provider: "Chip",
        fund_type: "fund",
        ticker_symbol: "",
        start_date: new Date(),
        expected_annual_return: 8,
        risk_preset: "medium",
        initial_deposit: undefined,
        recurring_amount: undefined,
        recurring_frequency: "monthly",
        notes: "",
      });
    }
  }, [open, defaultValues]);

  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
  };

  const handleRiskPresetChange = (preset: string) => {
    form.setValue("risk_preset", preset);
    const returnRate = RISK_PRESETS[preset as keyof typeof RISK_PRESETS];
    if (returnRate) {
      form.setValue("expected_annual_return", returnRate);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle>
            {mode === "create" ? "Add Investment" : "Edit Investment"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === "create"
              ? "Set up a new investment to track"
              : "Update your investment details"}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fund Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ChipX AI Fund" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Chip" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="ticker_symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ticker Symbol (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. INTL.L for WisdomTree AI" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("2000-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Risk Preset</FormLabel>
              <div className="flex gap-2">
                {(["conservative", "medium", "aggressive"] as const).map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={form.watch("risk_preset") === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleRiskPresetChange(preset)}
                    className="flex-1 capitalize"
                  >
                    {preset} ({RISK_PRESETS[preset]}%)
                  </Button>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="expected_annual_return"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected Annual Return (%)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "create" && (
              <>
                <FormField
                  control={form.control}
                  name="initial_deposit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Lump Sum (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="recurring_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recurring Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0.00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="recurring_frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Any additional notes..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading
                  ? "Saving..."
                  : mode === "create"
                  ? "Create Investment"
                  : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
