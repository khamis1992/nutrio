import { readBoundedResponseJson } from "./boundedResponse.ts";

const IP_LOOKUP_BASE = "https://ipwho.is";
const IP_LOOKUP_RESPONSE_LIMIT = 8 * 1024;

export interface IpGeoLookupResult {
  countryCode: string;
  country: string | null;
  city: string | null;
}

export function normalizeIpAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ip = value.trim();
  if (!ip || ip.length > 64 || /[\s,/%?#]/.test(ip)) return null;

  const ipv4Parts = ip.split(".");
  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every(
      (part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
    )
  ) {
    return ipv4Parts.map((part) => String(Number(part))).join(".");
  }

  if (
    ip.includes(":") &&
    /^[0-9a-f:.]+$/i.test(ip) &&
    !ip.includes(":::")
  ) {
    return ip.toLowerCase();
  }

  return null;
}

export async function lookupIpGeo(
  ipAddress: string,
  fetcher: typeof fetch = fetch,
): Promise<IpGeoLookupResult> {
  const ip = normalizeIpAddress(ipAddress);
  if (!ip) throw new Error("invalid_ip_address");

  const response = await fetcher(
    `${IP_LOOKUP_BASE}/${encodeURIComponent(ip)}?fields=success,country_code,country,city`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) throw new Error("ip_lookup_failed");

  const data = await readBoundedResponseJson<{
    success?: unknown;
    country_code?: unknown;
    country?: unknown;
    city?: unknown;
  }>(response, IP_LOOKUP_RESPONSE_LIMIT, {
    tooLargeCode: "ip_lookup_invalid_response",
    invalidBodyCode: "ip_lookup_invalid_response",
  });
  const countryCode = typeof data.country_code === "string"
    ? data.country_code.trim().toUpperCase()
    : "";
  if (data.success !== true || !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("ip_lookup_invalid_response");
  }

  return {
    countryCode,
    country: typeof data.country === "string" ? data.country.slice(0, 120) : null,
    city: typeof data.city === "string" ? data.city.slice(0, 120) : null,
  };
}
