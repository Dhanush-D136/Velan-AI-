import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  verifyGeofence,
  detectSpoofingFlags,
} from '@velan/shared';

describe('Geofence & Haversine Distance Engine', () => {
  // Chennai Campus anchor coordinates
  const anchorLat = 13.0827;
  const anchorLng = 80.2707;

  it('calculates distance accurately for nearby points', () => {
    // Offset ~111m north (approx 0.001 deg lat)
    const studentLat = 13.0837;
    const studentLng = 80.2707;

    const distance = calculateHaversineDistance(anchorLat, anchorLng, studentLat, studentLng);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(125);
  });

  it('accepts student inside 500m geofence radius', () => {
    // ~60m away
    const studentLat = 13.0829;
    const studentLng = 80.2711;

    const result = verifyGeofence(anchorLat, anchorLng, studentLat, studentLng, 500, 10);
    expect(result.isWithinRadius).toBe(true);
    expect(result.distanceMeters).toBeLessThan(100);
  });

  it('rejects student outside geofence boundary', () => {
    // ~1.5 km away
    const studentLat = 13.0950;
    const studentLng = 80.2707;

    const result = verifyGeofence(anchorLat, anchorLng, studentLat, studentLng, 500, 15);
    expect(result.isWithinRadius).toBe(false);
    expect(result.distanceMeters).toBeGreaterThan(1000);
  });

  it('detects spoofing flags: zero synthetic accuracy and mock location provider', () => {
    const flagsResult = detectSpoofingFlags({
      accuracy: 0,
      isMocked: true,
      timestamp: Date.now(),
      currentCoord: { lat: anchorLat, lng: anchorLng },
    });

    expect(flagsResult.isSuspicious).toBe(true);
    expect(flagsResult.flags).toContain('ZERO_ACCURACY_SUSPICIOUS');
    expect(flagsResult.flags).toContain('MOCK_PROVIDER_DETECTED');
  });

  it('detects impossible teleportation speed (> 45 m/s)', () => {
    const now = Date.now();
    const flagsResult = detectSpoofingFlags({
      accuracy: 12,
      timestamp: now,
      previousCoord: {
        lat: 13.0827,
        lng: 80.2707,
        timestamp: now - 5000, // 5 seconds ago
      },
      currentCoord: {
        lat: 13.0980, // ~1.7 km jump in 5s
        lng: 80.2707,
      },
    });

    expect(flagsResult.isSuspicious).toBe(true);
    expect(flagsResult.flags).toContain('IMPOSSIBLE_SPEED_TELEPORT');
  });
});
