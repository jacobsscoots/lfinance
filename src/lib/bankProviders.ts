// Bank provider name mapping utility
// Fixes the "Open banking" label bug by mapping provider IDs to readable names

export const BANK_PROVIDER_LABELS: Record<string, string> = {
  monzo: "Monzo",
  starling: "Starling Bank",
  barclays: "Barclays",
  hsbc: "HSBC",
  lloyds: "Lloyds",
  natwest: "NatWest",
  santander: "Santander",
  nationwide: "Nationwide",
  halifax: "Halifax",
  rbs: "Royal Bank of Scotland",
  tsb: "TSB",
  coop: "Co-operative Bank",
  metro: "Metro Bank",
  virgin: "Virgin Money",
  revolut: "Revolut",
  chase: "Chase UK",
  truelayer: "Connected Bank",
};

/**
 * Get a human-readable label for a bank provider
 * @param provider - The provider ID from the database
 * @returns Human-readable bank name, never "Open banking"
 */
export function getProviderLabel(provider?: string | null): string {
  if (!provider) return "Bank Account";
  
  const normalized = provider.toLowerCase().trim();
  
  // Check direct mapping
  if (BANK_PROVIDER_LABELS[normalized]) {
    return BANK_PROVIDER_LABELS[normalized];
  }
  
  // Check if provider contains a known bank name
  for (const [key, label] of Object.entries(BANK_PROVIDER_LABELS)) {
    if (normalized.includes(key)) {
      return label;
    }
  }
  
  // Capitalize first letter of each word as fallback
  // But never return "Open banking" or similar generic terms
  if (normalized === "open banking" || normalized === "openbanking" || normalized === "truelayer") {
    return "Connected Bank";
  }
  
  return provider
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
