interface NominatimResult {
  lat: string;
  lon: string;
}

export interface GeoCoords {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(address: string): Promise<GeoCoords | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', address);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'DriverTracker/1.0 (driver-checkin-app)',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data: NominatimResult[] = await res.json();
    if (data.length === 0) return null;

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}