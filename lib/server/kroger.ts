// ─── Kroger API client ────────────────────────────────────────────────────────
//
// Required env vars:
//   KROGER_CLIENT_ID      — from developer.kroger.com
//   KROGER_CLIENT_SECRET  — from developer.kroger.com
//   KROGER_LOCATION_ID    — your nearest Kroger store ID (find via /api/kroger/locations)
//
// The access token is cached in module memory (valid 30 min). On cold starts
// and after expiry it is re-fetched automatically.

const KROGER_BASE = "https://api.kroger.com/v1";

// ─── Token cache (module-level, lives for the duration of the function instance) ──

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 30_000) {
    return cachedToken;
  }

  const id     = process.env.KROGER_CLIENT_ID;
  const secret = process.env.KROGER_CLIENT_SECRET;
  if (!id || !secret) throw new Error("KROGER_CLIENT_ID and KROGER_CLIENT_SECRET are required.");

  const res = await fetch(`${KROGER_BASE}/connect/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type":  "application/x-www-form-urlencoded",
      Authorization:   `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials&scope=product.compact",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kroger token fetch failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken    = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KrogerProduct {
  productId: string;
  description: string;
  brand: string;
  categories: string[];
  items: Array<{
    itemId: string;
    size: string;
    price?: {
      regular: number;
      promo: number;
    };
  }>;
}

export interface PriceLookupResult {
  name:           string;
  found:          boolean;
  productId?:     string;
  description?:   string;
  brand?:         string;
  size?:          string;
  regularPrice?:  number;
  promoPrice?:    number;
  bestPrice?:     number;       // promo if available, else regular
  storeId?:       string;
}

// ─── Product search ───────────────────────────────────────────────────────────

export async function searchProducts(
  term: string,
  locationId?: string,
  limit = 5
): Promise<KrogerProduct[]> {
  const token = await getAccessToken();
  const loc   = locationId ?? process.env.KROGER_LOCATION_ID ?? "";

  const params = new URLSearchParams({
    "filter.term":       term,
    "filter.limit":      String(limit),
    "filter.fulfillment": "ais",
  });
  if (loc) params.set("filter.locationId", loc);

  const res = await fetch(`${KROGER_BASE}/products?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kroger product search failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { data?: KrogerProduct[] };
  return data.data ?? [];
}

// ─── Price lookup (name → best price) ────────────────────────────────────────

export async function lookupPrice(name: string, locationId?: string): Promise<PriceLookupResult> {
  try {
    const products = await searchProducts(name, locationId, 3);
    if (products.length === 0) return { name, found: false };

    // Take the first result — Kroger returns relevance-ranked results
    const product = products[0];
    const item    = product.items?.find((i) => i.price) ?? product.items?.[0];

    if (!item) return { name, found: false };

    const regularPrice = item.price?.regular;
    const promoPrice   = item.price?.promo && item.price.promo > 0 ? item.price.promo : undefined;
    const bestPrice    = promoPrice ?? regularPrice;

    return {
      name,
      found:        true,
      productId:    product.productId,
      description:  product.description,
      brand:        product.brand,
      size:         item.size,
      regularPrice,
      promoPrice,
      bestPrice,
      storeId:      locationId ?? process.env.KROGER_LOCATION_ID,
    };
  } catch (err) {
    console.error(`Kroger price lookup failed for "${name}":`, err);
    return { name, found: false };
  }
}

// ─── Batch price lookup ───────────────────────────────────────────────────────

export async function lookupPricesBatch(
  names: string[],
  locationId?: string,
  concurrency = 3
): Promise<PriceLookupResult[]> {
  const results: PriceLookupResult[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < names.length; i += concurrency) {
    const batch = names.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((n) => lookupPrice(n, locationId)));
    results.push(...batchResults);
    // Small delay between batches to be a good API citizen
    if (i + concurrency < names.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
}

// ─── Location search ──────────────────────────────────────────────────────────

export interface KrogerLocation {
  locationId:   string;
  chain:        string;
  name:         string;
  addressLine1: string;
  city:         string;
  state:        string;
  zipCode:      string;
  distance?:    number;
}

export async function findLocations(zipCode: string, radiusMiles = 10): Promise<KrogerLocation[]> {
  const token = await getAccessToken();

  const params = new URLSearchParams({
    "filter.zipCode.near": zipCode,
    "filter.radiusInMiles": String(radiusMiles),
    "filter.limit":         "10",
  });

  const res = await fetch(`${KROGER_BASE}/locations?${params}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kroger location search failed (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    data?: Array<{
      locationId: string;
      chain: string;
      name: string;
      address: { addressLine1: string; city: string; state: string; zipCode: string };
      geolocation?: { distanceInMiles?: number };
    }>;
  };

  return (data.data ?? []).map((loc) => ({
    locationId:   loc.locationId,
    chain:        loc.chain,
    name:         loc.name,
    addressLine1: loc.address?.addressLine1 ?? "",
    city:         loc.address?.city ?? "",
    state:        loc.address?.state ?? "",
    zipCode:      loc.address?.zipCode ?? "",
    distance:     loc.geolocation?.distanceInMiles,
  }));
}

export function isKrogerConfigured(): boolean {
  return Boolean(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET);
}
