/**
 * Geofencing utilities — pure functions, no side effects.
 */

// ── Haversine distance (metres) ──────────────────────────────
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns true when the employee is within the geofence radius
 * centred on the client's lat/lon.
 */
export function isWithinGeofence(
  employeeLat: number,
  employeeLon: number,
  clientLat:   number,
  clientLon:   number,
  radiusMeters: number,
): boolean {
  return haversineDistance(employeeLat, employeeLon, clientLat, clientLon) <= radiusMeters;
}

// ── Format distance for display ──────────────────────────────
export function formatDistance(metres: number): string {
  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }
  return `${(metres / 1000).toFixed(1)} km`;
}

// ── Simple mileage accumulator ───────────────────────────────
/**
 * Calculates total driving distance between a series of GPS points
 * (clock-in locations across multiple visits in a day).
 */
export function totalMileage(
  points: Array<{ lat: number; lon: number }>,
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(
      points[i - 1].lat, points[i - 1].lon,
      points[i].lat,     points[i].lon,
    );
  }
  return total; // in metres
}

/** Metres → miles */
export function metresToMiles(metres: number): number {
  return metres / 1609.344;
}

/** Metres → kilometres */
export function metresToKm(metres: number): number {
  return metres / 1000;
}
