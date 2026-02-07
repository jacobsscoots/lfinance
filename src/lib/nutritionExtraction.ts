// Client-side text parsing utilities for nutrition data

export interface ExtractedNutrition {
  name?: string;
  brand?: string;
  image_url?: string;
  price?: number;
  offer_price?: number;
  offer_label?: string;
  pack_size_grams?: number;
  retailer?: string;
  energy_kj?: number;
  energy_kcal?: number;
  fat?: number;
  saturates?: number;
  carbohydrate?: number;
  sugars?: number;
  fibre?: number;
  protein?: number;
  salt?: number;
  sodium?: number;
  source_url?: string;
  confidence: Record<string, "high" | "medium" | "low">;
}

// Field mappings for common label variations
const FIELD_PATTERNS: Record<string, { patterns: RegExp[]; field: keyof ExtractedNutrition }> = {
  energy_kj: {
    patterns: [
      /energy\s*[\(\[]?\s*kj\s*[\)\]]?\s*:?\s*([\d,.]+)/i,
      /energie\s*[\(\[]?\s*kj\s*[\)\]]?\s*:?\s*([\d,.]+)/i,
      /kilojoules?\s*:?\s*([\d,.]+)/i,
      /([\d,.]+)\s*kj/i,
    ],
    field: "energy_kj",
  },
  energy_kcal: {
    patterns: [
      /energy\s*[\(\[]?\s*kcal\s*[\)\]]?\s*:?\s*([\d,.]+)/i,
      /calories?\s*:?\s*([\d,.]+)/i,
      /energy\s+value\s*:?\s*([\d,.]+)/i,
      /([\d,.]+)\s*kcal/i,
    ],
    field: "energy_kcal",
  },
  fat: {
    patterns: [
      /(?:total\s+)?fat\s*:?\s*([\d,.]+)\s*g/i,
      /lipides?\s*:?\s*([\d,.]+)\s*g/i,
    ],
    field: "fat",
  },
  saturates: {
    patterns: [
      /(?:of which\s+)?saturates?\s*:?\s*([\d,.]+)\s*g/i,
      /saturated\s+fat\s*:?\s*([\d,.]+)\s*g/i,
      /sat\.?\s*fat\s*:?\s*([\d,.]+)\s*g/i,
    ],
    field: "saturates",
  },
  carbohydrate: {
    patterns: [
      /carbohydrates?\s*:?\s*([\d,.]+)\s*g/i,
      /carbs?\s*:?\s*([\d,.]+)\s*g/i,
      /total\s+carbohydrate\s*:?\s*([\d,.]+)\s*g/i,
    ],
    field: "carbohydrate",
  },
  sugars: {
    patterns: [
      /(?:of which\s+)?sugars?\s*:?\s*([\d,.]+)\s*g/i,
      /total\s+sugars?\s*:?\s*([\d,.]+)\s*g/i,
    ],
    field: "sugars",
  },
  fibre: {
    patterns: [
      /(?:dietary\s+)?fibr?e\s*:?\s*([\d,.]+)\s*g/i,
    ],
    field: "fibre",
  },
  protein: {
    patterns: [
      /proteins?\s*:?\s*([\d,.]+)\s*g/i,
    ],
    field: "protein",
  },
  salt: {
    patterns: [
      /salt\s*:?\s*([\d,.]+)\s*g/i,
    ],
    field: "salt",
  },
  sodium: {
    patterns: [
      /sodium\s*:?\s*([\d,.]+)\s*(?:m?g)?/i,
    ],
    field: "sodium",
  },
};

function parseNumber(str: string): number | undefined {
  if (!str) return undefined;
  const cleaned = str.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

export function parseNutritionText(text: string): ExtractedNutrition {
  const result: ExtractedNutrition = {
    confidence: {},
  };

  // Normalize text
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ");

  // Extract each field
  for (const [key, { patterns, field }] of Object.entries(FIELD_PATTERNS)) {
    for (const pattern of patterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        const value = parseNumber(match[1]);
        if (value !== undefined) {
          (result as any)[field] = value;
          result.confidence[field] = "medium";
          break;
        }
      }
    }
  }

  // Convert sodium to salt if salt not found
  if (!result.salt && result.sodium) {
    result.salt = result.sodium * 2.5;
    result.confidence.salt = "low"; // Mark as converted
    delete result.sodium;
  }

  // Try to extract pack size
  const packSizeMatch = normalizedText.match(/(\d+)\s*(?:g|ml)\s*(?:pack|net|e)/i);
  if (packSizeMatch) {
    result.pack_size_grams = parseNumber(packSizeMatch[1]);
    result.confidence.pack_size_grams = "medium";
  }

  return result;
}

// Check if a field has low confidence (was converted or uncertain)
export function isLowConfidence(extracted: ExtractedNutrition, field: string): boolean {
  return extracted.confidence[field] === "low";
}

// Merge extracted data with existing form values
export function mergeExtractedData<T extends Record<string, any>>(
  existing: T,
  extracted: ExtractedNutrition,
  selectedFields: Set<string>
): T {
  const result = { ...existing };

  const fieldMapping: Record<string, keyof ExtractedNutrition> = {
    name: "name",
    brand: "brand",
    energy_kj_per_100g: "energy_kj",
    calories_per_100g: "energy_kcal",
    fat_per_100g: "fat",
    saturates_per_100g: "saturates",
    carbs_per_100g: "carbohydrate",
    sugars_per_100g: "sugars",
    fibre_per_100g: "fibre",
    protein_per_100g: "protein",
    salt_per_100g: "salt",
    price: "price",
    offer_price: "offer_price",
    offer_label: "offer_label",
    pack_size_grams: "pack_size_grams",
    retailer: "retailer",
    source_url: "source_url",
    image_url: "image_url",
  };

  for (const [formField, extractedField] of Object.entries(fieldMapping)) {
    if (selectedFields.has(formField)) {
      const value = extracted[extractedField];
      if (value !== undefined) {
        (result as any)[formField] = value;
      }
    }
  }

  return result;
}
