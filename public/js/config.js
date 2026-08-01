/**
 * Optional live-data endpoint. Leave null for a fully static deployment.
 * The endpoint receives ?station=<id> and should return normalized departures.
 */
export const REALTIME_ENDPOINT = null;
export const REALTIME_TIMEOUT_MS = 3500;
export const REALTIME_MAX_AGE_MS = 90_000;

