// utils/locationHelpers.ts
import * as Location from 'expo-location';
import { getDistance } from 'geolib';

export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access location was denied');
  }
  const location = await Location.getCurrentPositionAsync({});
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}

export function isWithinRadius(studentLoc: any, teacherLoc: any, radius = 500) {
  const distance = getDistance(studentLoc, teacherLoc);
  return distance <= radius;
}
