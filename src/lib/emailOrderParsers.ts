/**
 * Email order parsing utilities for automatic order detection.
 * Extracts retailer, order number, tracking number from email subjects/bodies.
 */

// --- Retailer Detection ---

interface RetailerMatch {
  retailerName: string;
  confidence: "high" | "medium" | "low";
}

const RETAILER_DOMAINS: Record<string, string> = {
  "amazon.co.uk": "Amazon",
  "amazon.com": "Amazon",
  "boots.com": "Boots",
  "superdrug.com": "Superdrug",
  "savers.co.uk": "Savers",
  "tesco.com": "Tesco",
  "sainsburys.co.uk": "Sainsburys",
  "wilko.com": "Wilko",
  "bodyshop.com": "The Body Shop",
};

export function matchRetailerFromEmail(fromEmail: string): RetailerMatch | null {
  const domain = fromEmail.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  // Exact domain match
  for (const [pattern, name] of Object.entries(RETAILER_DOMAINS)) {
    if (domain === pattern || domain.endsWith(`.${pattern}`)) {
      return { retailerName: name, confidence: "high" };
    }
  }

  // Partial match in domain
  for (const [pattern, name] of Object.entries(RETAILER_DOMAINS)) {
    const key = pattern.split(".")[0];
    if (domain.includes(key)) {
      return { retailerName: name, confidence: "medium" };
    }
  }

  return null;
}

// --- Subject Keyword Detection ---

const DISPATCH_KEYWORDS = [
  "dispatched",
  "shipped",
  "on its way",
  "out for delivery",
  "your order has been sent",
  "order confirmed",
  "order confirmation",
  "we've sent your order",
];

const DELIVERY_KEYWORDS = [
  "delivered",
  "your order has arrived",
  "successfully delivered",
  "left in safe place",
];

export type EmailType = "order" | "dispatch" | "delivery" | "unknown";

export function classifyEmail(subject: string, bodySnippet?: string): EmailType {
  const text = `${subject} ${bodySnippet || ""}`.toLowerCase();

  if (DELIVERY_KEYWORDS.some((kw) => text.includes(kw))) return "delivery";
  if (DISPATCH_KEYWORDS.some((kw) => text.includes(kw))) return "dispatch";
  if (text.includes("order") && (text.includes("confirm") || text.includes("receipt"))) return "order";

  return "unknown";
}

// --- Order Number Extraction ---

const ORDER_NUMBER_PATTERNS = [
  /order\s*(?:#|number|no\.?|ref\.?)\s*[:.]?\s*([A-Z0-9-]{4,30})/i,
  /order\s*([0-9]{3,}-[0-9]{3,}-[0-9]{3,})/i, // Amazon format
  /ref(?:erence)?[:\s]+([A-Z0-9-]{4,30})/i,
  /confirmation\s*(?:#|number)\s*[:.]?\s*([A-Z0-9-]{4,30})/i,
];

export function extractOrderNumber(text: string): string | null {
  for (const pattern of ORDER_NUMBER_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// --- Tracking Number Extraction ---

const TRACKING_PATTERNS = [
  // Royal Mail
  { carrier: "Royal Mail", pattern: /\b([A-Z]{2}\d{9}GB)\b/i },
  // DPD
  { carrier: "DPD", pattern: /\b(\d{14})\b/ },
  // Hermes/Evri
  { carrier: "Evri", pattern: /\b(\d{16})\b/ },
  // DHL
  { carrier: "DHL", pattern: /\b(\d{10,11})\b/ },
  // Generic tracking
  { carrier: null, pattern: /tracking\s*(?:#|number|no\.?|ref\.?)\s*[:.]?\s*([A-Z0-9]{8,30})/i },
  { carrier: null, pattern: /track(?:ing)?\s*[:]\s*([A-Z0-9-]{8,30})/i },
];

export interface TrackingMatch {
  trackingNumber: string;
  carrier: string | null;
}

export function extractTrackingNumber(text: string): TrackingMatch | null {
  for (const { carrier, pattern } of TRACKING_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return { trackingNumber: match[1].trim(), carrier };
    }
  }
  return null;
}

// --- Amount Extraction ---

export function extractAmount(text: string): number | null {
  const match = text.match(/(?:£|GBP)\s?([\d,]+\.?\d{0,2})/);
  if (match?.[1]) {
    return parseFloat(match[1].replace(",", ""));
  }
  return null;
}

// --- Combine All ---

export interface ParsedOrderEmail {
  retailer: RetailerMatch | null;
  emailType: EmailType;
  orderNumber: string | null;
  tracking: TrackingMatch | null;
  amount: number | null;
}

export function parseOrderEmail(
  fromEmail: string,
  subject: string,
  bodySnippet: string
): ParsedOrderEmail {
  const fullText = `${subject}\n${bodySnippet}`;
  return {
    retailer: matchRetailerFromEmail(fromEmail),
    emailType: classifyEmail(subject, bodySnippet),
    orderNumber: extractOrderNumber(fullText),
    tracking: extractTrackingNumber(fullText),
    amount: extractAmount(fullText),
  };
}
