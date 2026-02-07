import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  tariff_name: z.string().min(1, "Tariff name is required"),
  provider: z.string().min(1, "Provider is required"),
  fuel_type: z.string().min(1, "Fuel type is required"),
  unit_rate_kwh: z.coerce.number().positive("Must be positive"),
  standing_charge_daily: z.coerce.number().min(0, "Must be 0 or positive"),
  is_fixed: z.boolean(),
  fix_end_date: z.date().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TariffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormValues) => void;
  isLoading?: boolean;
  defaultValues?: Partial<FormValues>;
  mode?: "create" | "edit";
}

const PROVIDERS = ["British Gas", "EDF", "Octopus Energy", "E.ON", "Scottish Power", "SSE", "Bulb", "OVO"];

export function TariffFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  defaultValues,
  mode = "create",
}: TariffFormDialogProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tariff_name: defaultValues?.tariff_name || "Standard Variable",
      provider: defaultValues?.provider || "",
      fuel_type: defaultValues?.fuel_type || "electricity",
      unit_rate_kwh: defaultValues?.unit_rate_kwh || 24.5,
      standing_charge_daily: defaultValues?.standing_charge_daily || 53.35,
      is_fixed: defaultValues?.is_fixed || false,
      fix_end_date: defaultValues?.fix_end_date,
    },
  });

  const isFixed = form.watch("is_fixed");

  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
    if (mode === "create") {
      form.reset();
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[450px]">
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle>
            {mode === "create" ? "Add Tariff" : "Edit Tariff"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Enter your current energy tariff details
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fuel_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuel Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="electricity">Electricity</SelectItem>
                        <SelectItem value="gas">Gas</SelectItem>
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROVIDERS.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tariff_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tariff Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Standard Variable Tariff" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unit_rate_kwh"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Rate (p/kWh)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="standing_charge_daily"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standing Charge (p/day)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>Fixed Tariff</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Is this a fixed-rate tariff?
                </p>
              </div>
              <FormField
                control={form.control}
                name="is_fixed"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {isFixed && (
              <FormField
                control={form.control}
                name="fix_end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fixed Rate Ends</FormLabel>
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
                            {field.value ? format(field.value, "PPP") : <span>Select date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                {isLoading ? "Saving..." : "Save Tariff"}
              </Button>
            </div>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
