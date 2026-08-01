import {
  REALTIME_ENDPOINT,
  REALTIME_MAX_AGE_MS,
  REALTIME_TIMEOUT_MS,
} from "./config.js";

const CACHE_PREFIX = "metro-salerno:live:";

function readCache(stationId) {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_PREFIX + stationId));
    if (!value?.observedAt || !Array.isArray(value.departures)) return null;
    return value;
  } catch {
    return null;
  }
}

function writeCache(stationId, value) {
  try {
    localStorage.setItem(CACHE_PREFIX + stationId, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing; live data still works.
  }
}

function normalize(payload) {
  const departures = Array.isArray(payload) ? payload : payload?.departures;
  if (!Array.isArray(departures)) throw new Error("Invalid realtime payload");
  return {
    observedAt: payload.observedAt || new Date().toISOString(),
    departures: departures
      .filter(item => item && item.time && item.destination)
      .map(item => ({
        time: String(item.time),
        destination: String(item.destination),
        direction: item.direction || null,
        delayMinutes: Number(item.delayMinutes || 0),
        status: item.status || "running",
      })),
  };
}

export async function getRealtimeDepartures(stationId) {
  const cached = readCache(stationId);
  if (!REALTIME_ENDPOINT || !navigator.onLine) {
    if (!cached) return null;
    const age = Date.now() - Date.parse(cached.observedAt);
    return { ...cached, source: age <= REALTIME_MAX_AGE_MS ? "cached" : "stale" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REALTIME_TIMEOUT_MS);
  try {
    const url = new URL(REALTIME_ENDPOINT, window.location.href);
    url.searchParams.set("station", stationId);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Realtime HTTP ${response.status}`);
    const live = normalize(await response.json());
    writeCache(stationId, live);
    return { ...live, source: "live" };
  } catch {
    if (!cached) return null;
    const age = Date.now() - Date.parse(cached.observedAt);
    return { ...cached, source: age <= REALTIME_MAX_AGE_MS ? "cached" : "stale" };
  } finally {
    clearTimeout(timeout);
  }
}
