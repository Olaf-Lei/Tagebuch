import * as Location from 'expo-location';
import { Alert } from 'react-native';

export interface GeoTag {
  latitude: number;
  longitude: number;
  locationName: string;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return geo.city ?? geo.district ?? geo.subregion ?? geo.region ?? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  } catch {
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
}

export async function captureLocation(): Promise<GeoTag | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Standort', 'Standortzugriff verweigert. Bitte in den Einstellungen aktivieren.');
    return null;
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  const locationName = await reverseGeocode(latitude, longitude);
  return { latitude, longitude, locationName };
}
