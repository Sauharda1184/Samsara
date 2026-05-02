import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { Facility } from "../types";

interface MapViewProps {
  facilities: Facility[];
  nearbyIds?: Set<string>;
  selectedId?: string | null;
  userLocation?: { lat: number; lon: number } | null;
  radiusKm?: number;
  mapSearchQuery?: string;
  routeGeometry?: GeoJSON.LineString | null;
  onFacilityClick?: (facility: Facility) => void;
}

const OSM_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
      maxzoom: 19,
    },
  },
  layers: [{ id: "osm-layer", type: "raster", source: "osm" }],
};

const NEPAL_CENTER: [number, number] = [84.124, 28.394];
const NEPAL_ZOOM = 6.5;

const TYPE_COLOR: Record<string, string> = {
  Teaching: "#7c3aed",
  Government: "#2563eb",
  Community: "#0891b2",
  Specialty: "#d97706",
  Private: "#dc2626",
};

function buildRadiusCircle(lon: number, lat: number, radiusKm: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const R = 6371;
  const points = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const bearing = (i / points) * 2 * Math.PI;
    const d = radiusKm / R;
    const latR = (lat * Math.PI) / 180;
    const lonR = (lon * Math.PI) / 180;
    const newLat = Math.asin(Math.sin(latR) * Math.cos(d) + Math.cos(latR) * Math.sin(d) * Math.cos(bearing));
    const newLon = lonR + Math.atan2(Math.sin(bearing) * Math.sin(d) * Math.cos(latR), Math.cos(d) - Math.sin(latR) * Math.sin(newLat));
    coords.push([(newLon * 180) / Math.PI, (newLat * 180) / Math.PI]);
  }
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };
}

function buildGeoJSON(
  facilities: Facility[],
  nearbyIds?: Set<string>,
  selectedId?: string | null,
  searchQuery?: string
): GeoJSON.FeatureCollection {
  const q = searchQuery?.toLowerCase().trim() ?? "";
  return {
    type: "FeatureCollection",
    features: facilities.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.longitude, f.latitude] },
      properties: {
        id: f.id,
        name: f.name,
        province: f.province,
        verification_status: f.verification_status,
        hospital_type: f.hospital_type,
        specialties: f.specialties,
        latitude: f.latitude,
        longitude: f.longitude,
        total_beds: f.total_beds,
        available_beds: f.available_beds,
        total_doctors: f.total_doctors,
        emergency_services: f.emergency_services,
        phone: f.phone ?? "",
        established_year: f.established_year ?? "",
        accreditation: f.accreditation,
        isNearby: nearbyIds ? nearbyIds.has(f.id) : false,
        isSelected: f.id === selectedId,
        isSearchMatch: q ? f.name.toLowerCase().includes(q) : true,
      },
    })),
  };
}

function buildHoverHTML(p: Record<string, unknown>): string {
  const color = TYPE_COLOR[p.hospital_type as string] ?? "#dc2626";
  const isVerified = p.verification_status === "verified";
  const specialties = p.specialties !== "General" ? (p.specialties as string) : null;
  const emergency = p.emergency_services === true || p.emergency_services === "true";
  const beds = Number(p.total_beds);
  const availBeds = Number(p.available_beds);
  const bedPct = beds > 0 ? Math.round((availBeds / beds) * 100) : 0;
  const bedColor = bedPct > 30 ? "#15803d" : bedPct > 10 ? "#d97706" : "#dc2626";

  return `
    <div style="font-family:system-ui,sans-serif;padding:14px 16px;min-width:240px;max-width:290px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
        <p style="font-weight:700;font-size:13px;line-height:1.35;margin:0;color:#111">${p.name}</p>
        <span style="background:${isVerified ? "#dcfce7" : "#fef9c3"};color:${isVerified ? "#166534" : "#854d0e"};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap;flex-shrink:0">
          ${isVerified ? "✓ Verified" : "Unverified"}
        </span>
      </div>

      <p style="color:#6b7280;font-size:11px;margin:0 0 6px">${p.province} · Nepal</p>

      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
        <span style="background:${color}18;color:${color};padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600">${p.hospital_type}</span>
        ${emergency ? `<span style="background:#fce7f3;color:#9d174d;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600">🚨 Emergency</span>` : ""}
        ${p.accreditation !== "None" ? `<span style="background:#ede9fe;color:#5b21b6;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600">${p.accreditation}</span>` : ""}
      </div>

      ${specialties ? `<p style="color:#6b7280;font-size:11px;margin:0 0 8px">🏷 ${(p.specialties as string).replace(/,/g, " · ")}</p>` : ""}

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
        <div style="background:#f9fafb;border-radius:8px;padding:8px 10px">
          <p style="font-size:10px;color:#9ca3af;margin:0 0 2px">Beds available</p>
          <p style="font-size:15px;font-weight:700;color:${bedColor};margin:0">${availBeds}</p>
          <p style="font-size:10px;color:#9ca3af;margin:2px 0 0">of ${beds} total</p>
        </div>
        <div style="background:#f9fafb;border-radius:8px;padding:8px 10px">
          <p style="font-size:10px;color:#9ca3af;margin:0 0 2px">Doctors</p>
          <p style="font-size:15px;font-weight:700;color:#111;margin:0">${p.total_doctors}</p>
          <p style="font-size:10px;color:#9ca3af;margin:2px 0 0">on staff</p>
        </div>
      </div>

      <div style="font-size:11px;color:#6b7280;display:flex;flex-direction:column;gap:3px">
        ${p.phone ? `<span>📞 ${p.phone}</span>` : ""}
        ${p.established_year ? `<span>🏗 Est. ${p.established_year}</span>` : ""}
      </div>
    </div>
  `;
}

export default function MapView({
  facilities,
  nearbyIds,
  selectedId,
  userLocation,
  radiusKm = 50,
  mapSearchQuery,
  routeGeometry,
  onFacilityClick,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const clickPopupRef = useRef<maplibregl.Popup | null>(null);
  const facilitiesRef = useRef(facilities);
  facilitiesRef.current = facilities;
  const onFacilityClickRef = useRef(onFacilityClick);
  onFacilityClickRef.current = onFacilityClick;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: NEPAL_CENTER,
      zoom: NEPAL_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");

    map.on("load", () => {
      // Route line — added first so it renders BELOW hospital dots
      map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "route-outline", type: "line", source: "route", paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 } });
      map.addLayer({ id: "route-line", type: "line", source: "route", paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 1 } });

      // Facilities source — no clustering
      map.addSource("facilities", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: "facilities-circle",
        type: "circle",
        source: "facilities",
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "isSelected"], true], 11,
            ["==", ["get", "isNearby"], true], 9,
            ["==", ["get", "isSearchMatch"], false], 5,
            7,
          ],
          "circle-color": [
            "case",
            ["==", ["get", "isSelected"], true], "#1e3a8a",
            ["==", ["get", "isNearby"], true], "#15803d",
            ["==", ["get", "isSearchMatch"], false], "#9ca3af",
            ["==", ["get", "hospital_type"], "Teaching"], "#7c3aed",
            ["==", ["get", "hospital_type"], "Government"], "#2563eb",
            ["==", ["get", "hospital_type"], "Community"], "#0891b2",
            ["==", ["get", "hospital_type"], "Specialty"], "#d97706",
            "#dc2626",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": [
            "case",
            ["==", ["get", "isSearchMatch"], false], 0.35,
            0.92,
          ],
        },
      });

      // Radius circle
      map.addSource("radius-circle", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "radius-fill", type: "fill", source: "radius-circle", paint: { "fill-color": "#2563eb", "fill-opacity": 0.06 } });
      map.addLayer({ id: "radius-border", type: "line", source: "radius-circle", paint: { "line-color": "#2563eb", "line-width": 2, "line-dasharray": [4, 3] } });

      // Hover popup
      map.on("mouseenter", "facilities-circle", (e) => {
        if (!e.features?.length) return;
        map.getCanvas().style.cursor = "pointer";
        const props = e.features[0].properties as Record<string, unknown>;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        if (hoverPopupRef.current) hoverPopupRef.current.remove();
        hoverPopupRef.current = new maplibregl.Popup({ offset: 14, maxWidth: "300px", closeButton: false })
          .setLngLat(coords)
          .setHTML(buildHoverHTML(props))
          .addTo(map);
      });

      map.on("mouseleave", "facilities-circle", () => {
        map.getCanvas().style.cursor = "";
        if (hoverPopupRef.current) { hoverPopupRef.current.remove(); hoverPopupRef.current = null; }
      });

      // Click → fire callback + click popup with directions
      map.on("click", "facilities-circle", (e) => {
        if (!e.features?.length) return;
        const props = e.features[0].properties as Record<string, unknown>;
        const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

        const osmDir = `https://www.openstreetmap.org/directions?to=${props.latitude},${props.longitude}`;
        const gmDir = `https://www.google.com/maps/dir/?api=1&destination=${props.latitude},${props.longitude}`;

        if (clickPopupRef.current) clickPopupRef.current.remove();
        clickPopupRef.current = new maplibregl.Popup({ offset: 14, maxWidth: "260px" })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:10px 12px">
              <p style="font-weight:700;font-size:12px;margin:0 0 8px;color:#111">${props.name}</p>
              <div style="display:flex;gap:6px">
                <a href="${osmDir}" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:6px 0;background:#f3f4f6;color:#374151;border-radius:6px;font-size:11px;font-weight:500;text-decoration:none">🗺 OSM</a>
                <a href="${gmDir}" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:6px 0;background:#f3f4f6;color:#374151;border-radius:6px;font-size:11px;font-weight:500;text-decoration:none">📍 Google</a>
              </div>
            </div>
          `)
          .addTo(map);

        const fac = facilitiesRef.current.find((f) => f.id === props.id);
        if (fac && onFacilityClickRef.current) onFacilityClickRef.current(fac);
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update facility GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("facilities") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(buildGeoJSON(facilities, nearbyIds, selectedId, mapSearchQuery));
  }, [facilities, nearbyIds, selectedId, mapSearchQuery]);

  // Update route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("route") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!routeGeometry) {
      src.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    src.setData({ type: "Feature", geometry: routeGeometry, properties: {} });
  }, [routeGeometry]);

  // Update radius circle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("radius-circle") as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (!userLocation) { src.setData({ type: "FeatureCollection", features: [] }); return; }
    src.setData({ type: "FeatureCollection", features: [buildRadiusCircle(userLocation.lon, userLocation.lat, radiusKm)] });
  }, [userLocation, radiusKm]);

  // Fly to nearby hospitals when location is set
  useEffect(() => {
    if (!nearbyIds || nearbyIds.size === 0 || !mapRef.current) return;
    const nearby = facilities.filter((f) => nearbyIds.has(f.id));
    if (!nearby.length) return;
    if (nearby.length === 1) {
      mapRef.current.flyTo({ center: [nearby[0].longitude, nearby[0].latitude], zoom: 13 });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    nearby.forEach((f) => bounds.extend([f.longitude, f.latitude]));
    mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 13 });
  }, [nearbyIds, facilities]);

  // Also fly to the user location immediately when set (before nearby loads)
  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    mapRef.current.flyTo({ center: [userLocation.lon, userLocation.lat], zoom: 12, duration: 1200 });
  }, [userLocation]);

  // User location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
    if (!userLocation) return;
    const el = document.createElement("div");
    el.style.cssText = `width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px #2563eb,0 2px 8px rgba(37,99,235,0.4);`;
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([userLocation.lon, userLocation.lat])
      .setPopup(new maplibregl.Popup().setHTML("<p style='padding:6px 8px;font-size:12px;font-weight:600'>📍 Your location</p>"))
      .addTo(map);
  }, [userLocation]);

  return <div ref={containerRef} className="w-full h-full" />;
}
