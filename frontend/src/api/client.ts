import type { Facility, FacilityNearby } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listFacilities(): Promise<Facility[]> {
    return fetchJson("/facilities");
  },

  getFacility(id: string): Promise<Facility> {
    return fetchJson(`/facilities/${id}`);
  },

  searchFacilities(q: string): Promise<Facility[]> {
    return fetchJson(`/facilities/search?q=${encodeURIComponent(q)}`);
  },

  nearbyFacilities(lat: number, lon: number, radiusKm = 50): Promise<FacilityNearby[]> {
    return fetchJson(`/facilities/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
  },

  facilitiesByProvince(name: string): Promise<Facility[]> {
    return fetchJson(`/facilities/province?name=${encodeURIComponent(name)}`);
  },

  facilitiesBySpecialty(name: string): Promise<Facility[]> {
    return fetchJson(`/facilities/specialty?name=${encodeURIComponent(name)}`);
  },

  updateFacility(
    id: string,
    payload: { verification_status?: string; latitude?: number; longitude?: number }
  ): Promise<Facility> {
    return fetchJson(`/facilities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
};

export async function geocodeLocation(
  query: string
): Promise<{ lat: number; lon: number; displayName: string } | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    { headers: { "Accept-Language": "en" } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}
