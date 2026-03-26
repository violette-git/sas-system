/**
 * useGeofence — captures the employee's current GPS location and
 * checks it against the client's registered coordinates.
 *
 * Returns:
 *   checkGeofence(clientLat, clientLon) → GeofenceResult
 *   getCurrentLocation()               → LocationCoords | null
 */

import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { useAuthStore } from '@/features/auth/store/authStore';
import { isWithinGeofence, haversineDistance, formatDistance } from '../utils/geoUtils';

export interface LocationCoords {
  lat: number;
  lon: number;
}

export type GeofenceStatus =
  | 'within'       // inside radius → all clear
  | 'outside'      // outside radius → show warning
  | 'no_client_location'  // client has no lat/lon → skip check
  | 'permission_denied'   // user denied location permission
  | 'unavailable';        // GPS unavailable on device

export interface GeofenceResult {
  status:         GeofenceStatus;
  distance:       number | null;    // metres
  formattedDist:  string | null;
  coords:         LocationCoords | null;
}

export function useGeofence() {
  const { company } = useAuthStore();
  const [isChecking, setIsChecking] = useState(false);

  /** Get current GPS position. Returns null on failure. */
  const getCurrentLocation = useCallback(async (): Promise<LocationCoords | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch {
      return null;
    }
  }, []);

  /**
   * Checks whether the employee is within the geofence radius for a client.
   *
   * @param clientLat   Latitude of the client's service address
   * @param clientLon   Longitude of the client's service address
   */
  const checkGeofence = useCallback(
    async (
      clientLat: number | null | undefined,
      clientLon: number | null | undefined,
    ): Promise<GeofenceResult> => {
      // If the client has no coordinates, skip geofence check
      if (!clientLat || !clientLon) {
        return { status: 'no_client_location', distance: null, formattedDist: null, coords: null };
      }

      setIsChecking(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return { status: 'permission_denied', distance: null, formattedDist: null, coords: null };
        }

        let pos: Location.LocationObject;
        try {
          pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        } catch {
          return { status: 'unavailable', distance: null, formattedDist: null, coords: null };
        }

        const coords: LocationCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const radius = (company as { geofence_radius_meters?: number } | null)?.geofence_radius_meters ?? 500;
        const dist   = haversineDistance(coords.lat, coords.lon, clientLat, clientLon);

        const within = isWithinGeofence(coords.lat, coords.lon, clientLat, clientLon, radius);

        return {
          status:        within ? 'within' : 'outside',
          distance:      dist,
          formattedDist: formatDistance(dist),
          coords,
        };
      } finally {
        setIsChecking(false);
      }
    },
    [company],
  );

  return { checkGeofence, getCurrentLocation, isChecking };
}
