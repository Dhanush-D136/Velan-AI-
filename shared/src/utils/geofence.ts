/**
 * Geofencing & Anti-Spoofing Utilities for Velan AI
 */

const EARTH_RADIUS_METERS = 6371000;

export interface HaversineResult {
  distanceMeters: number;
  isWithinRadius: boolean;
  effectiveRadiusMeters: number;
  accuracyAllowanceMeters: number;
}

/**
 * Calculates great-circle distance between two GPS coordinates using the Haversine formula.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c * 10) / 10;
}

/**
 * Verifies if student coordinates fall inside the faculty anchor geofence,
 * incorporating GPS accuracy tolerance.
 */
export function verifyGeofence(
  anchorLat: number,
  anchorLng: number,
  studentLat: number,
  studentLng: number,
  radiusMeters: number,
  studentAccuracyMeters: number = 15
): HaversineResult {
  const rawDistance = calculateHaversineDistance(anchorLat, anchorLng, studentLat, studentLng);
  // Allow modest GPS fuzziness up to 20m or half of student accuracy
  const accuracyAllowanceMeters = Math.min(20, Math.max(0, studentAccuracyMeters * 0.5));
  const effectiveRadiusMeters = radiusMeters + accuracyAllowanceMeters;

  return {
    distanceMeters: rawDistance,
    isWithinRadius: rawDistance <= effectiveRadiusMeters,
    effectiveRadiusMeters,
    accuracyAllowanceMeters,
  };
}

/**
 * Anti-spoofing flags detection
 */
export function detectSpoofingFlags(params: {
  accuracy: number;
  isMocked?: boolean;
  timestamp: number;
  previousCoord?: { lat: number; lng: number; timestamp: number } | null;
  currentCoord: { lat: number; lng: number };
}): { isSuspicious: boolean; flags: string[] } {
  const flags: string[] = [];
  const now = Date.now();

  // 1. Explicit mock provider flag (from Android/mock location detectors)
  if (params.isMocked) {
    flags.push('MOCK_PROVIDER_DETECTED');
  }

  // 2. Unusually low or synthetic accuracy (e.g., exactly 0.0 or constant fabricated accuracy)
  if (params.accuracy === 0) {
    flags.push('ZERO_ACCURACY_SUSPICIOUS');
  } else if (params.accuracy > 150) {
    flags.push('VERY_POOR_ACCURACY');
  }

  // 3. Stale fix (older than 90 seconds)
  const ageSeconds = Math.abs(now - params.timestamp) / 1000;
  if (ageSeconds > 90) {
    flags.push('STALE_LOCATION_FIX');
  }

  // 4. Impossible speed / teleportation jump check if previous fix exists
  if (params.previousCoord) {
    const timeDeltaSeconds = Math.max(1, (params.timestamp - params.previousCoord.timestamp) / 1000);
    const distanceMeters = calculateHaversineDistance(
      params.previousCoord.lat,
      params.previousCoord.lng,
      params.currentCoord.lat,
      params.currentCoord.lng
    );
    const speedMps = distanceMeters / timeDeltaSeconds;
    // Human running/vehicle in campus limit: > 45 m/s (~162 km/h) jump is impossible
    if (speedMps > 45 && distanceMeters > 200) {
      flags.push('IMPOSSIBLE_SPEED_TELEPORT');
    }
  }

  return {
    isSuspicious: flags.length > 0,
    flags,
  };
}
