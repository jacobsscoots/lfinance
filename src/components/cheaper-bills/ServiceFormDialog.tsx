import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Check, ChevronsUpDown } from "lucide-react";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  service_type: z.string().min(1, "Service type is required"),
  provider: z.string().min(1, "Provider is required"),
  plan_name: z.string().optional(),
  monthly_cost: z.coerce.number().min(0, "Must be positive"),
  contract_start_date: z.date().optional(),
  contract_end_date: z.date().optional(),
  exit_fee: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  current_speed_mbps: z.coerce.number().min(0).optional(),
  preferred_contract_months: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: FormValues) => void;
  isLoading?: boolean;
  defaultValues?: Partial<FormValues>;
  mode?: "create" | "edit";
}

const SERVICE_TYPES = [
  { value: "energy", label: "Energy (Electric/Gas)" },
  { value: "broadband", label: "Broadband" },
  { value: "mobile", label: "Mobile" },
  { value: "insurance", label: "Insurance" },
  { value: "streaming", label: "Streaming" },
];

const COMMON_PROVIDERS: Record<string, string[]> = {
  energy: ["British Gas", "EDF", "Octopus Energy", "E.ON", "Scottish Power", "SSE", "Bulb", "OVO", "Outfox Energy", "Shell Energy", "Utility Warehouse"],
  broadband: ["BT", "Sky", "Virgin Media", "TalkTalk", "Plusnet", "EE", "Vodafone", "Fibrely", "Zen Internet", "Hyperoptic"],
  mobile: ["EE", "Three", "O2", "Vodafone", "Tesco Mobile", "giffgaff", "VOXI", "1pMobile", "Lebara", "Smarty"],
  insurance: ["Aviva", "Direct Line", "Admiral", "Churchill", "LV=", "More Than"],
  streaming: ["Netflix", "Disney+", "Amazon Prime", "NOW TV", "Apple TV+", "Spotify"],
};

export function ServiceFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  defaultValues,
  mode = "create",
}: ServiceFormDialogProps) {
  const [providerOpen, setProviderOpen] = useState(false);
  const [customProvider, setCustomProvider] = useState("");
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      service_type: defaultValues?.service_type || "energy",
      provider: defaultValues?.provider || "",
      plan_name: defaultValues?.plan_name || "",
      monthly_cost: defaultValues?.monthly_cost || 0,
      contract_start_date: defaultValues?.contract_start_date,
      contract_end_date: defaultValues?.contract_end_date,
      exit_fee: defaultValues?.exit_fee || 0,
      notes: defaultValues?.notes || "",
      current_speed_mbps: (defaultValues as any)?.current_speed_mbps || undefined,
      preferred_contract_months: (defaultValues as any)?.preferred_contract_months || undefined,
    },
  });

  const serviceType = form.watch("service_type");
  const currentProvider = form.watch("provider");
  const baseProviders = COMMON_PROVIDERS[serviceType] || [];
  
  // Include custom provider if it doesn't exist in the list
  const providers = customProvider && !baseProviders.includes(customProvider) 
    ? [...baseProviders, customProvider]
    : baseProviders;

  const handleSubmit = (data: FormValues) => {
    onSubmit(data);
    if (mode === "create") {
      form.reset();
      setCustomProvider("");
    }
  };
  
  // Reset provider when service type changes
  useEffect(() => {
    if (!baseProviders.includes(currentProvider)) {
      form.setValue("provider", "");
    }
  }, [serviceType]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle>
            {mode === "create" ? "Add Service" : "Edit Service"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Track a service to find better deals
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SERVICE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
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
                  <FormItem className="flex flex-col">
                    <FormLabel>Provider</FormLabel>
                    <Popover open={providerOpen} onOpenChange={setProviderOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value || "Select or type..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                          <CommandInput 
                            placeholder="Search or type new..." 
                            value={customProvider}
                            onValueChange={setCustomProvider}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {customProvider ? (
                                <button
                                  type="button"
                                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent rounded"
                                  onClick={() => {
                                    field.onChange(customProvider);
                                    setProviderOpen(false);
                                  }}
                                >
                                  Add "{customProvider}"
                                </button>
                              ) : (
                                "Type to add a provider"
                              )}
                            </CommandEmpty>
                            <CommandGroup>
                              {providers.map((p) => (
                                <CommandItem
                                  key={p}
                                  value={p}
                                  onSelect={() => {
                                    field.onChange(p);
                                    setProviderOpen(false);
                                    setCustomProvider("");
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === p ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {p}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="plan_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plan Name (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Fix & Save 24M" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monthly_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Cost (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exit_fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exit Fee (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Broadband-specific fields */}
            {serviceType === "broadband" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="current_speed_mbps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Speed (Mbps)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g., 67" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="preferred_contract_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Contract (months)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g., 18" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contract_start_date"
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
                            {field.value ? format(field.value, "PPP") : <span>Optional</span>}
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

              <FormField
                control={form.control}
                name="contract_end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
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
                            {field.value ? format(field.value, "PPP") : <span>Rolling</span>}
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
            </div>

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
                {isLoading ? "Saving..." : mode === "create" ? "Add Service" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
