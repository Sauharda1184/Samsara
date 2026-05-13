import { useState, useCallback } from "react";
import { Loader2, LocateFixed, Search, X, SlidersHorizontal, BedDouble, AlertCircle } from "lucide-react";
import { PROVINCES, SPECIALTIES, SERVICES, FACILITY_CATEGORIES, type Province, type Specialty, type Service, type FacilityCategory } from "../types";
import { geocodeLocation } from "../api/client";
import { cn } from "../lib/utils";

interface SidebarProps {
  totalCount: number;
  filteredCount: number;
  nearbyCount: number;
  province: Province;
  specialty: Specialty;
  service: Service;
  facilityCategory: FacilityCategory;
  hasAvailableBeds: boolean;
  hasEmergency: boolean;
  onProvinceChange: (p: Province) => void;
  onSpecialtyChange: (s: Specialty) => void;
  onServiceChange: (s: Service) => void;
  onFacilityCategoryChange: (c: FacilityCategory) => void;
  onHasAvailableBedsChange: (v: boolean) => void;
  onHasEmergencyChange: (v: boolean) => void;
  onLocationChange: (loc: { lat: number; lon: number } | null) => void;
  onRadiusChange: (km: number) => void;
  radius: number;
  hasLocation: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  totalCount, filteredCount, nearbyCount,
  province, specialty, service, facilityCategory, hasAvailableBeds, hasEmergency,
  onProvinceChange, onSpecialtyChange, onServiceChange, onFacilityCategoryChange, onHasAvailableBedsChange, onHasEmergencyChange,
  onLocationChange, onRadiusChange,
  radius, hasLocation, isOpen, onClose,
}: SidebarProps) {
  const [locationQuery, setLocationQuery] = useState("");
  const [resolvedPlace, setResolvedPlace] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleTextSearch = useCallback(async () => {
    if (!locationQuery.trim()) return;
    setGeoLoading(true);
    setGeoError(null);
    const result = await geocodeLocation(locationQuery.trim());
    setGeoLoading(false);
    if (!result) { setGeoError('Location not found. Try "Kathmandu" or "Pokhara".'); return; }
    setResolvedPlace(result.displayName.split(",").slice(0, 2).join(", "));
    onLocationChange({ lat: result.lat, lon: result.lon });
  }, [locationQuery, onLocationChange]);

  const handleBrowserLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => { onLocationChange({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setResolvedPlace("Your current location"); setGeoLoading(false); },
      (err) => { setGeoError(`Location error: ${err.message}`); setGeoLoading(false); },
      { timeout: 10000 }
    );
  }, [onLocationChange]);

  const handleClear = useCallback(() => {
    onLocationChange(null); setLocationQuery(""); setResolvedPlace(null); setGeoError(null);
  }, [onLocationChange]);

  const activeFilterCount = [
    province !== "All", specialty !== "All", service !== "All",
    facilityCategory !== "All", hasAvailableBeds, hasEmergency,
  ].filter(Boolean).length;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={onClose} />}

      <aside className={cn(
        "flex flex-col h-full bg-card border-r border-border w-72 shrink-0 z-30",
        "fixed md:relative inset-y-0 left-0 transition-transform duration-300",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">S</span>
              </div>
              <h1 className="text-base font-semibold text-foreground">Samsara</h1>
              <span className="text-xs text-muted-foreground ml-auto">v0.5</span>
            </div>
            <p className="text-xs text-muted-foreground ml-9">Healthcare Discovery · Nepal</p>
          </div>
          <button onClick={onClose} className="md:hidden text-muted-foreground hover:text-foreground mt-0.5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted px-2 py-2 text-center">
              <p className="text-base font-bold text-foreground">{totalCount}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-2 py-2 text-center">
              <p className="text-base font-bold text-blue-700">{filteredCount}</p>
              <p className="text-[10px] text-blue-600">Shown</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 px-2 py-2 text-center">
              <p className="text-base font-bold text-green-700">{nearbyCount}</p>
              <p className="text-[10px] text-green-600">Nearby</p>
            </div>
          </div>

          {/* Location search */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Find Nearby Hospitals</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text" value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTextSearch()}
                placeholder="Type your location…"
                className="w-full pl-9 pr-8 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
              />
              {locationQuery && (
                <button onClick={() => setLocationQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button onClick={handleTextSearch} disabled={geoLoading || !locationQuery.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search Location
            </button>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" />
            </div>
            <button onClick={handleBrowserLocation} disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
              Use My Location
            </button>
            {resolvedPlace && (
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-md px-2.5 py-1.5">
                <LocateFixed className="h-3.5 w-3.5 text-green-600 shrink-0" />
                <span className="text-xs text-green-800 flex-1 truncate">{resolvedPlace}</span>
                <button onClick={handleClear} className="text-green-600 hover:text-green-800"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
            {geoError && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-2.5 py-1.5">{geoError}</p>}
            {hasLocation && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Search radius</span><span className="font-medium text-foreground">{radius} km</span>
                </div>
                <input type="range" min={5} max={200} step={5} value={radius}
                  onChange={(e) => onRadiusChange(Number(e.target.value))}
                  className="w-full h-1.5 accent-primary" />
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
              {activeFilterCount > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-bold">{activeFilterCount}</span>
              )}
            </p>

            {/* Has available beds toggle */}
            <button
              onClick={() => onHasAvailableBedsChange(!hasAvailableBeds)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors",
                hasAvailableBeds
                  ? "bg-green-50 border-green-300 text-green-800"
                  : "bg-background border-input text-foreground hover:bg-accent"
              )}
            >
              <BedDouble className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Has available beds</span>
              <span className={cn("h-4 w-8 rounded-full transition-colors relative shrink-0", hasAvailableBeds ? "bg-green-500" : "bg-muted-foreground/30")}>
                <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform", hasAvailableBeds ? "translate-x-4" : "translate-x-0.5")} />
              </span>
            </button>

            {/* Emergency services toggle */}
            <button
              onClick={() => onHasEmergencyChange(!hasEmergency)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors",
                hasEmergency
                  ? "bg-red-50 border-red-300 text-red-800"
                  : "bg-background border-input text-foreground hover:bg-accent"
              )}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Emergency services</span>
              <span className={cn("h-4 w-8 rounded-full transition-colors relative shrink-0", hasEmergency ? "bg-red-500" : "bg-muted-foreground/30")}>
                <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform", hasEmergency ? "translate-x-4" : "translate-x-0.5")} />
              </span>
            </button>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Facility Type</label>
              <select value={facilityCategory} onChange={(e) => onFacilityCategoryChange(e.target.value as FacilityCategory)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                {FACILITY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Province</label>
              <select value={province} onChange={(e) => onProvinceChange(e.target.value as Province)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Specialty</label>
              <select value={specialty} onChange={(e) => onSpecialtyChange(e.target.value as Specialty)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Service</label>
              <select value={service} onChange={(e) => onServiceChange(e.target.value as Service)}
                className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => { onProvinceChange("All"); onSpecialtyChange("All"); onServiceChange("All"); onFacilityCategoryChange("All"); onHasAvailableBedsChange(false); onHasEmergencyChange(false); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline text-center"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Legend</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {[
                { color: "#dc2626", label: "Private" },
                { color: "#7c3aed", label: "Teaching" },
                { color: "#2563eb", label: "Government" },
                { color: "#0891b2", label: "Community" },
                { color: "#d97706", label: "Specialty" },
                { color: "#15803d", label: "Nearby" },
                { color: "#059669", label: "Healthpost" },
                { color: "#0284c7", label: "Clinic" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 border-t border-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Coordinates via public geocoding. Verify before clinical use.
          </p>
        </div>
      </aside>
    </>
  );
}
