// Bank provider name mapping utility
// Fixes the "Open banking" label bug by mapping provider IDs to readable names

export const BANK_PROVIDER_LABELS: Record<string, string> = {
  // Standard provider IDs
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
  "capital-one": "Capital One",
  capitalone: "Capital One",
  
  // TrueLayer Open Banking prefixed IDs (ob-xxx format)
  "ob-monzo": "Monzo",
  "ob-starling": "Starling Bank",
  "ob-barclays": "Barclays",
  "ob-hsbc": "HSBC",
  "ob-lloyds": "Lloyds",
  "ob-natwest": "NatWest",
  "ob-santander": "Santander",
  "ob-nationwide": "Nationwide",
  "ob-halifax": "Halifax",
  "ob-rbs": "Royal Bank of Scotland",
  "ob-tsb": "TSB",
  "ob-coop": "Co-operative Bank",
  "ob-metro": "Metro Bank",
  "ob-virgin": "Virgin Money",
  "ob-revolut": "Revolut",
  "ob-chase": "Chase UK",
  "ob-first-direct": "First Direct",
  "ob-tide": "Tide",
  "ob-starling-bank": "Starling Bank",
  "ob-capital-one": "Capital One",
  "ob-capitalone": "Capital One",
  
  // Generic fallbacks - map to "Bank Account" not "Connected Bank"
  truelayer: "Bank Account",
  "open banking": "Bank Account",
  openbanking: "Bank Account",
};

/**
 * Get a human-readable label for a bank provider
 * @param provider - The provider ID from the database
 * @returns Human-readable bank name, never "Open banking" or "Connected Bank"
 */
export function getProviderLabel(provider?: string | null): string {
  if (!provider) return "Bank Account";
  
  const normalized = provider.toLowerCase().trim();
  
  // Check direct mapping
  if (BANK_PROVIDER_LABELS[normalized]) {
    return BANK_PROVIDER_LABELS[normalized];
  }
  
  // Check if provider contains a known bank name (handles variations)
  for (const [key, label] of Object.entries(BANK_PROVIDER_LABELS)) {
    // Skip generic keys for partial matching
    if (key === "truelayer" || key === "open banking" || key === "openbanking") continue;
    
    if (normalized.includes(key.replace("ob-", ""))) {
      return label;
    }
  }
  
  // Capitalize first letter of each word as fallback
  // But never return "Open banking" or similar generic terms
  if (normalized === "open banking" || normalized === "openbanking" || normalized === "truelayer") {
    return "Bank Account";
  }
  
  return provider
    .split(/[\s_-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get connection status color and label for UI display
 * @param status - The connection status from bank_connections
 * @param lastSyncedAt - The last synced timestamp (optional)
 * @returns Object with tailwind color class and human-readable label
 */
export function getConnectionStatusColor(
  status?: string | null,
  lastSyncedAt?: string | null
): { color: string; bgColor: string; label: string } {
  // Check if sync is stale (more than 24 hours old)
  const isStale = lastSyncedAt
    ? new Date().getTime() - new Date(lastSyncedAt).getTime() > 24 * 60 * 60 * 1000
    : false;

  switch (status) {
    case 'connected':
      if (isStale) {
        return { color: 'text-amber-500', bgColor: 'bg-amber-500', label: 'Sync Pending' };
      }
      return { color: 'text-green-500', bgColor: 'bg-green-500', label: 'Connected' };
    case 'expired':
      return { color: 'text-amber-500', bgColor: 'bg-amber-500', label: 'Reconnect Required' };
    case 'pending':
      return { color: 'text-amber-500', bgColor: 'bg-amber-500', label: 'Pending' };
    case 'error':
    case 'failed':
      return { color: 'text-red-500', bgColor: 'bg-red-500', label: 'Error' };
    default:
      // No connection or unknown status
      return { color: 'text-muted-foreground', bgColor: 'bg-muted-foreground', label: 'Manual' };
  }
}
