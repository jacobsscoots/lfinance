// Dedupe hashing utility for deals
export async function hashDeal(
  title: string,
  price: number,
  store: string | null,
  url: string
): Promise<string> {
  const normalized = `${title.toLowerCase().trim()}|${price}|${(store || "").toLowerCase()}|${url}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Simple non-crypto hash for synchronous use (e.g., in tests)
export function hashDealSync(
  title: string,
  price: number,
  store: string | null,
  url: string
): string {
  const normalized = `${title.toLowerCase().trim()}|${price}|${(store || "").toLowerCase()}|${url}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

export interface DealForMatching {
  title: string;
  price: number;
  discount_percent: number | null;
  store: string | null;
  category: string | null;
}

export interface DealRule {
  keywords_include: string[];
  keywords_exclude: string[];
  category: string | null;
  min_price: number | null;
  max_price: number | null;
  min_discount_percent: number | null;
  store_whitelist: string[];
  store_blacklist: string[];
}

// Check if a deal matches a rule
export function dealMatchesRule(deal: DealForMatching, rule: DealRule): boolean {
  const titleLower = deal.title.toLowerCase();
  const storeLower = (deal.store || "").toLowerCase();

  // Check keywords include (any match)
  if (rule.keywords_include.length > 0) {
    const hasInclude = rule.keywords_include.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );
    if (!hasInclude) return false;
  }

  // Check keywords exclude (none match)
  if (rule.keywords_exclude.length > 0) {
    const hasExclude = rule.keywords_exclude.some((kw) =>
      titleLower.includes(kw.toLowerCase())
    );
    if (hasExclude) return false;
  }

  // Check category
  if (
    rule.category &&
    deal.category &&
    deal.category.toLowerCase() !== rule.category.toLowerCase()
  ) {
    return false;
  }

  // Check price range
  if (rule.min_price !== null && deal.price < rule.min_price) return false;
  if (rule.max_price !== null && deal.price > rule.max_price) return false;

  // Check discount
  if (
    rule.min_discount_percent !== null &&
    (deal.discount_percent === null || deal.discount_percent < rule.min_discount_percent)
  ) {
    return false;
  }

  // Check store whitelist
  if (rule.store_whitelist.length > 0) {
    const inWhitelist = rule.store_whitelist.some((s) =>
      storeLower.includes(s.toLowerCase())
    );
    if (!inWhitelist) return false;
  }

  // Check store blacklist
  if (rule.store_blacklist.length > 0) {
    const inBlacklist = rule.store_blacklist.some((s) =>
      storeLower.includes(s.toLowerCase())
    );
    if (inBlacklist) return false;
  }

  return true;
}

// Detect price drop
export function detectPriceDrop(
  newPrice: number,
  oldPrice: number,
  thresholdPercent: number = 5
): { dropped: boolean; dropPercent: number } {
  if (newPrice >= oldPrice) {
    return { dropped: false, dropPercent: 0 };
  }
  const dropPercent = Math.round((1 - newPrice / oldPrice) * 100);
  return {
    dropped: dropPercent >= thresholdPercent,
    dropPercent,
  };
}
