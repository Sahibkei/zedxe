import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AISSTREAM_WS_URL = "wss://stream.aisstream.io/v0/stream";
const CACHE_TTL_MS = 10_000;
const DEFAULT_LIMIT = 320;
const DEFAULT_WINDOW_SEC = 4;
const MAX_LIMIT = 800;
const MAX_WINDOW_SEC = 10;

type VesselRegion = "global" | "americas" | "europe" | "middle-east" | "asia-pacific";
type BoundingBox = [[number, number], [number, number]];

const REGION_BOUNDING_BOXES: Record<VesselRegion, BoundingBox[]> = {
    global: [[[-90, -180], [90, 180]]],
    americas: [[[-60, -170], [75, -20]]],
    europe: [[[30, -25], [72, 45]]],
    "middle-east": [[[10, 28], [40, 66]]],
    "asia-pacific": [
        [[-50, 90], [65, 180]],
        [[-50, -180], [65, -150]],
    ],
};

type VesselPoint = {
    mmsi: number;
    lat: number;
    lon: number;
    shipName: string | null;
    destination: string | null;
    speedKnots: number | null;
    courseDeg: number | null;
    headingDeg: number | null;
    navStatus: number | null;
};

type VesselResponse = {
    updatedAt: string;
    source: "aisstream";
    region: VesselRegion;
    vessels: VesselPoint[];
    stats: {
        tracked: number;
        avgSpeedKnots: number;
        movingCount: number;
    };
    warning?: string;
};

type AISStreamPayload = {
    Message?: {
        PositionReport?: {
            UserID?: number | string;
            Latitude?: number;
            Longitude?: number;
            Sog?: number;
            Cog?: number;
            TrueHeading?: number;
            NavigationalStatus?: number;
        };
    };
    MetaData?: {
        MMSI?: number | string;
        ShipName?: string;
        Destination?: string;
    };
};

const cache = new Map<string, { expiresAt: number; payload: VesselResponse }>();
const inFlight = new Map<string, Promise<VesselResponse>>();

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const toFinite = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

const toInt = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === "string" && value.trim()) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
};

const cleanText = (value: unknown) => {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text.length ? text : null;
};

const parseRegion = (input: string | null): VesselRegion => {
    if (!input) return "global";
    const normalized = input.trim().toLowerCase();
    if (normalized === "americas") return "americas";
    if (normalized === "europe") return "europe";
    if (normalized === "middle-east") return "middle-east";
    if (normalized === "asia-pacific") return "asia-pacific";
    return "global";
};

const parseEventPayload = async (data: unknown): Promise<AISStreamPayload | null> => {
    try {
        if (typeof data === "string") {
            return JSON.parse(data) as AISStreamPayload;
        }
        if (data instanceof Blob) {
            const buffer = await data.arrayBuffer();
            return JSON.parse(Buffer.from(buffer).toString("utf8")) as AISStreamPayload;
        }
        if (data instanceof ArrayBuffer) {
            return JSON.parse(Buffer.from(data).toString("utf8")) as AISStreamPayload;
        }
        if (ArrayBuffer.isView(data)) {
            return JSON.parse(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8")) as AISStreamPayload;
        }
        return null;
    } catch {
        return null;
    }
};

const extractVesselPoint = (payload: AISStreamPayload): VesselPoint | null => {
    const report = payload.Message?.PositionReport;
    if (!report) return null;

    const lat = toFinite(report.Latitude);
    const lon = toFinite(report.Longitude);
    if (lat === null || lon === null) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

    const mmsi = toInt(report.UserID) ?? toInt(payload.MetaData?.MMSI);
    if (mmsi === null || mmsi <= 0) return null;

    return {
        mmsi,
        lat,
        lon,
        shipName: cleanText(payload.MetaData?.ShipName),
        destination: cleanText(payload.MetaData?.Destination),
        speedKnots: toFinite(report.Sog),
        courseDeg: toFinite(report.Cog),
        headingDeg: toFinite(report.TrueHeading),
        navStatus: toInt(report.NavigationalStatus),
    };
};

const buildResponse = (points: VesselPoint[], region: VesselRegion, warning?: string): VesselResponse => {
    const speedSamples = points.map((point) => point.speedKnots ?? 0);
    const speedSum = speedSamples.reduce((acc, value) => acc + value, 0);
    const avgSpeedKnots = speedSamples.length ? speedSum / speedSamples.length : 0;
    const movingCount = speedSamples.filter((speed) => speed >= 1).length;

    return {
        updatedAt: new Date().toISOString(),
        source: "aisstream",
        region,
        vessels: points,
        stats: {
            tracked: points.length,
            avgSpeedKnots,
            movingCount,
        },
        warning,
    };
};

const collectVesselSnapshot = async (
    apiKey: string,
    limit: number,
    windowMs: number,
    region: VesselRegion
): Promise<VesselResponse> => {
    return new Promise<VesselResponse>((resolve) => {
        const points = new Map<number, VesselPoint>();
        let done = false;

        const finish = (warning?: string) => {
            if (done) return;
            done = true;
            try {
                socket.close();
            } catch {
                // ignore close errors
            }
            resolve(buildResponse(Array.from(points.values()), region, warning));
        };

        const socket = new WebSocket(AISSTREAM_WS_URL);

        const timeout = setTimeout(() => {
            finish();
        }, windowMs);

        socket.onopen = () => {
            const subscription = {
                APIKey: apiKey,
                BoundingBoxes: REGION_BOUNDING_BOXES[region],
                FilterMessageTypes: ["PositionReport"],
            };
            socket.send(JSON.stringify(subscription));
        };

        socket.onerror = () => {
            clearTimeout(timeout);
            finish("AISstream connection error.");
        };

        socket.onmessage = async (event) => {
            const payload = await parseEventPayload(event.data);
            if (!payload) return;
            const point = extractVesselPoint(payload);
            if (!point) return;

            if (!points.has(point.mmsi) && points.size >= limit) {
                return;
            }
            points.set(point.mmsi, point);
        };

        socket.onclose = () => {
            clearTimeout(timeout);
            finish();
        };
    });
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limit = clamp(Number.parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT, 50, MAX_LIMIT);
    const region = parseRegion(searchParams.get("region"));
    const windowSec = clamp(
        Number.parseInt(searchParams.get("windowSec") ?? `${DEFAULT_WINDOW_SEC}`, 10) || DEFAULT_WINDOW_SEC,
        2,
        MAX_WINDOW_SEC
    );

    const cacheKey = `${region}:${limit}:${windowSec}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload, {
            headers: { "Cache-Control": "no-store" },
        });
    }

    const apiKey = process.env.AISSTREAM_API_KEY ?? "";
    if (!apiKey) {
        return NextResponse.json(buildResponse([], region, "Missing AISSTREAM_API_KEY environment variable."), {
            headers: { "Cache-Control": "no-store" },
        });
    }

    if (!inFlight.has(cacheKey)) {
        inFlight.set(
            cacheKey,
            collectVesselSnapshot(apiKey, limit, windowSec * 1000, region)
            .then((payload) => {
                cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
                return payload;
            })
            .catch((error) => {
                console.error("AISstream vessel snapshot failed", error);
                return buildResponse([], region, "Failed to fetch AISstream vessel snapshot.");
            })
            .finally(() => {
                inFlight.delete(cacheKey);
            })
        );
    }

    const inFlightRequest = inFlight.get(cacheKey);
    if (!inFlightRequest) {
        return NextResponse.json(buildResponse([], region, "Vessel request initialization failed."), {
            headers: { "Cache-Control": "no-store" },
        });
    }

    const payload = await inFlightRequest;
    return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store" },
    });
}
