'use client';

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

type MapPoint = {
  id: string;
  driverName: string;
  locationName?: string;
  latitude: number;
  longitude: number;
  checkInTime: string;
  checkOutTime?: string;
};

type DriverMapProps = {
  points: MapPoint[];
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export default function DriverMap({ points }: DriverMapProps) {
  const defaultCenter: [number, number] = points.length
    ? [points[0].latitude, points[0].longitude]
    : [39.5, -98.35];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={points.length ? 10 : 4}
      className="h-[420px] w-full rounded-lg"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {points.map((point) => {
        const checkedOut = Boolean(point.checkOutTime);
        return (
          <CircleMarker
            key={point.id}
            center={[point.latitude, point.longitude]}
            radius={10}
            pathOptions={{
              color: checkedOut ? '#6b7280' : '#1d4ed8',
              fillColor: checkedOut ? '#9ca3af' : '#3b82f6',
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold text-gray-900">{point.driverName}</p>
                <p className="text-gray-700">{point.locationName || 'Unknown location'}</p>
                <p className="text-xs text-gray-500">Checked in: {formatTimestamp(point.checkInTime)}</p>
                <p className="text-xs text-gray-500">
                  Status: {checkedOut ? `Checked out at ${formatTimestamp(point.checkOutTime!)}` : 'Active'}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
