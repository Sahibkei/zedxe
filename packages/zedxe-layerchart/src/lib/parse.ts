import type { GeoDatum, HistogramDatum, ParsedResult, SankeyLink } from "./types";

function parseJson<T>(raw?: string | null): ParsedResult<T> {
  if (!raw) return { values: [], error: "No data provided" };
  try {
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed)) {
      return { values: [], error: "Data must be an array" };
    }
    return { values: parsed };
  } catch (error) {
    return { values: [], error: (error as Error).message };
  }
}

export function parseHistogram(raw?: string | null): ParsedResult<HistogramDatum> {
  const result = parseJson<HistogramDatum>(raw);
  if (!result.values.length) return result;
  const filtered = result.values.filter((item) => typeof item?.value === "number" && !Number.isNaN(item.value) && typeof item?.label === "string");
  if (!filtered.length) {
    return { values: [], error: "Histogram data missing numeric values" };
  }
  return { values: filtered };
}

export function parseGeo(raw?: string | null): ParsedResult<GeoDatum> {
  const result = parseJson<GeoDatum>(raw);
  if (!result.values.length) return result;
  const filtered = result.values.filter((item) => typeof item?.value === "number" && !Number.isNaN(item.value) && typeof item?.region === "string");
  if (!filtered.length) {
    return { values: [], error: "Geo data missing required fields" };
  }
  return { values: filtered };
}

export function parseSankey(raw?: string | null): ParsedResult<SankeyLink> {
  const result = parseJson<SankeyLink>(raw);
  if (!result.values.length) return result;
  const filtered = result.values.filter(
    (item) => typeof item?.value === "number" && !Number.isNaN(item.value) && typeof item?.source === "string" && typeof item?.target === "string"
  );
  if (!filtered.length) {
    return { values: [], error: "Sankey data missing required fields" };
  }
  return { values: filtered };
}
