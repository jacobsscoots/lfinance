import { Button } from "@/components/ui/button";
import { TOILETRY_CATEGORIES, LAUNDRY_CATEGORIES } from "@/lib/toiletryCalculations";
import { cn } from "@/lib/utils";

interface ToiletryCategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  section?: "toiletry" | "laundry";
}

export function ToiletryCategoryFilter({
  selectedCategory,
  onCategoryChange,
  section = "toiletry",
}: ToiletryCategoryFilterProps) {
  const categories = section === "laundry" ? LAUNDRY_CATEGORIES : TOILETRY_CATEGORIES;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={selectedCategory === null ? "default" : "outline"}
        size="sm"
        onClick={() => onCategoryChange(null)}
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category.value}
          variant={selectedCategory === category.value ? "default" : "outline"}
          size="sm"
          onClick={() => onCategoryChange(category.value)}
        >
          {category.label}
        </Button>
      ))}
    </div>
  );
}
