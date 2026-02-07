import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Scale, AlertCircle } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { validateWeightLog } from "@/lib/toiletryUsageCalculations";
import type { ToiletryItem } from "@/lib/toiletryCalculations";

const weightLogSchema = z.object({
  weight: z.coerce.number().positive("Weight must be greater than 0"),
  readingType: z.enum(["full", "regular", "empty"]),
});

type WeightLogValues = z.infer<typeof weightLogSchema>;

interface LogWeightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ToiletryItem | null;
  onSubmit: (itemId: string, weight: number, readingType: "full" | "regular" | "empty") => void;
  isLoading?: boolean;
}

export function LogWeightDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading = false,
}: LogWeightDialogProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  // Extended item type with weight fields
  const extendedItem = item as ToiletryItem & {
    full_weight_grams?: number | null;
    finished_at?: string | null;
    current_weight_grams?: number | null;
  };

  const hasFullWeight = extendedItem?.full_weight_grams != null;
  const isFinished = extendedItem?.finished_at != null;

  const form = useForm<WeightLogValues>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: {
      weight: 0,
      readingType: hasFullWeight ? "regular" : "full",
    },
  });

  const watchedReadingType = form.watch("readingType");

  const handleSubmit = (values: WeightLogValues) => {
    if (!item) return;

    // Validate the weight log
    const validation = validateWeightLog(
      values.readingType,
      extendedItem.full_weight_grams ?? null,
      extendedItem.finished_at ? new Date(extendedItem.finished_at) : null
    );

    if (!validation.valid) {
      setValidationError(validation.error || "Invalid weight log");
      return;
    }

    setValidationError(null);
    onSubmit(item.id, values.weight, values.readingType);
    onOpenChange(false);
    form.reset();
  };

  const getReadingTypeDescription = (type: string) => {
    switch (type) {
      case "full":
        return "Record this when you first open a new product. Place the full, unopened product on the scale.";
      case "regular":
        return "Record the current weight to track usage over time.";
      case "empty":
        return "Record the weight of the empty packaging. This will mark the item as finished.";
      default:
        return "";
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[425px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Log Weight - {item?.name}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        {isFinished && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This item has been marked as finished. Create a new item to track usage.
            </AlertDescription>
          </Alert>
        )}

        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scale Reading (grams)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="Enter weight"
                        {...field}
                        className="pr-8"
                        disabled={isFinished}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        g
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="readingType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reading Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="space-y-3"
                      disabled={isFinished}
                    >
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem 
                          value="full" 
                          id="full" 
                          disabled={hasFullWeight}
                        />
                        <div className="grid gap-1 leading-none">
                          <label
                            htmlFor="full"
                            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                              hasFullWeight ? "text-muted-foreground" : ""
                            }`}
                          >
                            First use (full weight)
                            {hasFullWeight && " ✓ Recorded"}
                          </label>
                          {!hasFullWeight && (
                            <p className="text-xs text-muted-foreground">
                              Record when first opening the product
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <RadioGroupItem 
                          value="regular" 
                          id="regular"
                          disabled={!hasFullWeight}
                        />
                        <div className="grid gap-1 leading-none">
                          <label
                            htmlFor="regular"
                            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                              !hasFullWeight ? "text-muted-foreground" : ""
                            }`}
                          >
                            Regular weighing
                          </label>
                          {hasFullWeight && (
                            <p className="text-xs text-muted-foreground">
                              Track usage over time
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start space-x-3">
                        <RadioGroupItem 
                          value="empty" 
                          id="empty"
                          disabled={!hasFullWeight}
                        />
                        <div className="grid gap-1 leading-none">
                          <label
                            htmlFor="empty"
                            className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
                              !hasFullWeight ? "text-muted-foreground" : ""
                            }`}
                          >
                            Empty (packaging weight)
                          </label>
                          {hasFullWeight && (
                            <p className="text-xs text-muted-foreground">
                              Marks item as finished
                            </p>
                          )}
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    {getReadingTypeDescription(watchedReadingType)}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {extendedItem?.current_weight_grams != null && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                <p>
                  <strong>Last recorded:</strong> {extendedItem.current_weight_grams}g
                </p>
                {extendedItem.full_weight_grams != null && (
                  <p>
                    <strong>Full weight:</strong> {extendedItem.full_weight_grams}g
                  </p>
                )}
              </div>
            )}

            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isFinished}>
                Save Weight
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
