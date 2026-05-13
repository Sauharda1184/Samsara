import { useState, useMemo, useCallback, useRef } from "react";
import { Menu, Search, X, CheckCircle, MapPin, Navigation, Route } from "lucide-react";
import type { Facility, Province, Specialty, Service, FacilityCategory } from "../types";
import { useAllFacilities, useNearbyFacilities, useUpdateFacility } from "../hooks/useFacilities";
import ChatBot from "../components/ChatBot";
import MapView, { type MapBounds } from "../components/MapView";
import Sidebar from "../components/Sidebar";
import { getRoute, type RouteResult } from "../api/client";
import { cn } from "../lib/utils";

export default function Dashboard() {
  // ── Filter state (single source of truth) ──────────────────────────────────
  const [province, setProvince] = useState<Province>("All");
  const [specialty, setSpecialty] = useState<Specialty>("All");
  const [service, setService] = useState<Service>("All");
  const [facilityCategory, setFacilityCategory] = useState<FacilityCategory>("All");
  const [hasAvailableBeds, setHasAvailableBeds] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [radius, setRadius] = useState(50);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mapSearch, setMapSearch] = useState("");
  const [routeData, setRouteData] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // ── Area search state ────────────────────────────────────────────────────────
  const [activeBounds, setActiveBounds] = useState<MapBounds | null>(null);
  const [hasPendingAreaSearch, setHasPendingAreaSearch] = useState(false);
  const pendingBoundsRef = useRef<MapBounds | null>(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: allFacilities = [], isLoading } = useAllFacilities();
  const { data: nearbyFacilities = [] } = useNearbyFacilities(
    userLocation?.lat ?? null, userLocation?.lon ?? null, radius
  );
  const updateFacility = useUpdateFacility();

  // ── Composable client-side filtering ───────────────────────────────────────
  const mapFacilities: Facility[] = useMemo(() => {
    return allFacilities.filter((f) => {
      if (facilityCategory !== "All" && f.facility_category !== facilityCategory) return false;
      if (province !== "All" && f.province !== province) return false;
      if (specialty !== "All" && !f.specialties.includes(specialty)) return false;
      if (service !== "All" && !f.services.includes(service)) return false;
      if (hasAvailableBeds && f.available_beds <= 0) return false;
      if (activeBounds) {
        if (f.longitude < activeBounds.west || f.longitude > activeBounds.east) return false;
        if (f.latitude < activeBounds.south || f.latitude > activeBounds.north) return false;
      }
      return true;
    });
  }, [allFacilities, facilityCategory, province, specialty, service, hasAvailableBeds, activeBounds]);

  const nearbyIds = useMemo<Set<string>>(
    () => new Set(nearbyFacilities.map((f) => f.id)),
    [nearbyFacilities]
  );

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleFacilityClick = useCallback((f: Facility) => {
    setSelectedFacility((prev) => {
      if (prev?.id === f.id) { setRouteData(null); return null; }
      return f;
    });
    setRouteData(null);
    if (userLocation) {
      setRouteLoading(true);
      getRoute(userLocation.lon, userLocation.lat, f.longitude, f.latitude)
        .then((r) => setRouteData(r))
        .finally(() => setRouteLoading(false));
    }
  }, [userLocation]);

  const handleLocationChange = useCallback((loc: { lat: number; lon: number } | null) => {
    setUserLocation(loc);
    if (!loc) { setSelectedFacility(null); setRouteData(null); }
  }, []);

  const handleMoveEnd = useCallback((bounds: MapBounds) => {
    pendingBoundsRef.current = bounds;
    setHasPendingAreaSearch(true);
  }, []);

  const handleVerify = useCallback(() => {
    if (!selectedFacility) return;
    const next = selectedFacility.verification_status === "verified" ? "unverified" : "verified";
    updateFacility.mutate(
      { id: selectedFacility.id, payload: { verification_status: next } },
      { onSuccess: (updated) => setSelectedFacility(updated) }
    );
  }, [selectedFacility, updateFacility]);

  const osmDir = selectedFacility
    ? `https://www.openstreetmap.org/directions?to=${selectedFacility.latitude},${selectedFacility.longitude}`
    : "#";
  const gmDir = selectedFacility
    ? `https://www.google.com/maps/dir/?api=1&destination=${selectedFacility.latitude},${selectedFacility.longitude}`
    : "#";

  const typeColor = (type: string) =>
    ({ Teaching: "#7c3aed", Government: "#2563eb", Community: "#0891b2", Specialty: "#d97706" }[type] ?? "#dc2626");

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar
        totalCount={allFacilities.length}
        filteredCount={mapFacilities.length}
        nearbyCount={nearbyFacilities.length}
        province={province}
        specialty={specialty}
        service={service}
        facilityCategory={facilityCategory}
        hasAvailableBeds={hasAvailableBeds}
        onProvinceChange={(p) => { setProvince(p); setSelectedFacility(null); }}
        onSpecialtyChange={(s) => { setSpecialty(s); setSelectedFacility(null); }}
        onServiceChange={(s) => { setService(s); setSelectedFacility(null); }}
        onFacilityCategoryChange={(c) => { setFacilityCategory(c); setSelectedFacility(null); }}
        onHasAvailableBedsChange={setHasAvailableBeds}
        onLocationChange={handleLocationChange}
        onRadiusChange={setRadius}
        radius={radius}
        hasLocation={userLocation !== null}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 relative overflow-hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden absolute top-3 left-3 z-10 bg-card border border-border rounded-lg p-2 shadow-md"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>

        {/* Area search controls */}
        {(hasPendingAreaSearch || activeBounds) && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            {hasPendingAreaSearch && (
              <button
                onClick={() => { setActiveBounds(pendingBoundsRef.current); setHasPendingAreaSearch(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border shadow-md text-xs font-medium text-foreground hover:bg-accent transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                {activeBounds ? "Re-search this area" : "Search this area"}
              </button>
            )}
            {activeBounds && (
              <button
                onClick={() => { setActiveBounds(null); setHasPendingAreaSearch(false); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 shadow-md text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <X className="h-3 w-3" /> Clear area filter
              </button>
            )}
          </div>
        )}

        {/* Floating map search */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-full max-w-sm px-4 md:px-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={mapSearch}
              onChange={(e) => setMapSearch(e.target.value)}
              placeholder="Search hospitals on map…"
              className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-ring transition-all"
            />
            {mapSearch && (
              <button onClick={() => setMapSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Loading hospitals…</p>
            </div>
          </div>
        )}

        <MapView
          facilities={mapFacilities}
          nearbyIds={nearbyIds}
          selectedId={selectedFacility?.id ?? null}
          userLocation={userLocation}
          radiusKm={radius}
          mapSearchQuery={mapSearch}
          routeGeometry={routeData?.geometry ?? null}
          onFacilityClick={handleFacilityClick}
          onMoveEnd={handleMoveEnd}
        />

        {/* Selected facility detail card */}
        {selectedFacility && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-10">
            <div className="bg-card/97 backdrop-blur-md rounded-2xl border border-border shadow-xl overflow-hidden">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: `${typeColor(selectedFacility.hospital_type)}18` }}>
                  <MapPin className="h-4 w-4" style={{ color: typeColor(selectedFacility.hospital_type) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug">{selectedFacility.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedFacility.province} · {selectedFacility.country}</p>
                </div>
                <button onClick={() => { setSelectedFacility(null); setRouteData(null); }} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Badges */}
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                  {selectedFacility.hospital_type}
                </span>
                {selectedFacility.specialties !== "General" &&
                  selectedFacility.specialties.split(",").map((s) => (
                    <span key={s} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">{s}</span>
                  ))}
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  selectedFacility.verification_status === "verified" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                )}>
                  {selectedFacility.verification_status === "verified" ? "✓ Verified" : "Unverified"}
                </span>
              </div>

              {/* Services */}
              {selectedFacility.services && (
                <div className="px-4 pb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Services</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedFacility.services.split(",").map((s) => (
                      <span key={s} className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Beds + Doctors */}
              <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">Available beds</p>
                  <p className="text-lg font-bold text-foreground">{selectedFacility.available_beds}
                    <span className="text-xs font-normal text-muted-foreground"> / {selectedFacility.total_beds}</span>
                  </p>
                </div>
                <div className="rounded-lg bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">Doctors on staff</p>
                  <p className="text-lg font-bold text-foreground">{selectedFacility.total_doctors}</p>
                </div>
              </div>

              {/* Route stats */}
              {userLocation && (routeLoading || routeData) && (
                <div className="mx-4 mb-3 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 flex items-center gap-2">
                  <Route className="h-4 w-4 text-blue-600 shrink-0" />
                  {routeLoading ? (
                    <span className="text-xs text-blue-700">Calculating route…</span>
                  ) : routeData ? (
                    <span className="text-xs text-blue-800">
                      <span className="font-semibold">{routeData.distance_km.toFixed(1)} km</span> by road ·{" "}
                      <span className="font-semibold">{Math.round(routeData.duration_min)} min</span> drive
                    </span>
                  ) : null}
                </div>
              )}

              {/* Actions */}
              <div className="px-4 pb-4 grid grid-cols-3 gap-2">
                <a href={osmDir} target="_blank" rel="noopener"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-colors">
                  <Navigation className="h-3.5 w-3.5" /> OSM
                </a>
                <a href={gmDir} target="_blank" rel="noopener"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-colors">
                  <Navigation className="h-3.5 w-3.5" /> Google
                </a>
                <button onClick={handleVerify} disabled={updateFacility.isPending}
                  className={cn("flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors",
                    selectedFacility.verification_status === "verified"
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                  )}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  {updateFacility.isPending ? "…" : selectedFacility.verification_status === "verified" ? "Unverify" : "Verify"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ChatBot userLocation={userLocation} />
      </main>
    </div>
  );
}
