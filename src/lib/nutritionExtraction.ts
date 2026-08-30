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
      /energy\s{0,20}[\(\[]?\s{0,20}kj\s{0,20}[\)\]]?\s{0,20}:?\s{0,20}([\d,.]{1,32})/i,
      /energie\s{0,20}[\(\[]?\s{0,20}kj\s{0,20}[\)\]]?\s{0,20}:?\s{0,20}([\d,.]{1,32})/i,
      /kilojoules?\s{0,20}:?\s{0,20}([\d,.]{1,32})/i,
      /([\d,.]{1,32})\s{0,20}kj/i,
    ],
    field: "energy_kj",
  },
  energy_kcal: {
    patterns: [
      /energy\s{0,20}[\(\[]?\s{0,20}kcal\s{0,20}[\)\]]?\s{0,20}:?\s{0,20}([\d,.]{1,32})/i,
      /calories?\s{0,20}:?\s{0,20}([\d,.]{1,32})/i,
      /energy\s{1,20}value\s{0,20}:?\s{0,20}([\d,.]{1,32})/i,
      /([\d,.]{1,32})\s{0,20}kcal/i,
    ],
    field: "energy_kcal",
  },
  fat: {
    patterns: [
      /(?:total\s{1,20})?fat\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
      /lipides?\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
    ],
    field: "fat",
  },
  saturates: {
    patterns: [
      /(?:of which\s{1,20})?saturates?\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
      /saturated\s{1,20}fat\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
      /sat\.?\s{0,20}fat\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
    ],
    field: "saturates",
  },
  carbohydrate: {
    patterns: [
      /carbohydrates?\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
      /carbs?\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
      /total\s{1,20}carbohydrate\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
    ],
    field: "carbohydrate",
  },
  sugars: {
    patterns: [
      /(?:of which\s{1,20})?sugars?\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
      /total\s{1,20}sugars?\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
    ],
    field: "sugars",
  },
  fibre: {
    patterns: [
      /(?:dietary\s{1,20})?fibr?e\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
    ],
    field: "fibre",
  },
  protein: {
    patterns: [
      /proteins?\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
    ],
    field: "protein",
  },
  salt: {
    patterns: [
      /salt\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}g/i,
    ],
    field: "salt",
  },
  sodium: {
    patterns: [
      /sodium\s{0,20}:?\s{0,20}([\d,.]{1,32})\s{0,20}(?:m?g)?/i,
    ],
    field: "sodium",
  },
};

function parseNumber(str: string): number | undefined {
  if (!str) return undefined;
  const cleaned = str.replaceAll(/,/g, "").trim();
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? undefined : num;
}

export function parseNutritionText(text: string): ExtractedNutrition {
  const result: ExtractedNutrition = {
    confidence: {},
  };

  // Normalize text
  const normalizedText = text
    .replaceAll(/\r\n/g, "\n")
    .replaceAll(/\t/g, " ")
    .replaceAll(/\s+/g, " ");

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
  const packSizeMatch = normalizedText.match(/(\d+)\s{0,20}(?:g|ml)\s{0,20}(?:pack|net|e)/i);
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
