import { MapPin, CheckCircle, AlertCircle } from "lucide-react";
import type { Facility, FacilityNearby } from "../types";
import { cn } from "../lib/utils";

interface FacilityCardProps {
  facility: Facility | FacilityNearby;
  isSelected?: boolean;
  isNearby?: boolean;
  onClick?: () => void;
}

function isNearbyFacility(f: Facility | FacilityNearby): f is FacilityNearby {
  return "distance_km" in f;
}

export default function FacilityCard({ facility, isSelected, isNearby, onClick }: FacilityCardProps) {
  const isVerified = facility.verification_status === "verified";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-md border transition-all duration-150",
        "hover:border-primary/50 hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring",
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : isNearby
          ? "border-green-300 bg-green-50"
          : "border-border bg-card"
      )}
    >
      <div className="flex items-start gap-2">
        <MapPin
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0",
            isSelected ? "text-primary" : isNearby ? "text-green-600" : "text-muted-foreground"
          )}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-snug truncate">{facility.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{facility.province}</p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full",
                isVerified
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              )}
            >
              {isVerified ? (
                <CheckCircle className="h-3 w-3" />
              ) : (
                <AlertCircle className="h-3 w-3" />
              )}
              {isVerified ? "Verified" : "Unverified"}
            </span>

            {isNearbyFacility(facility) && (
              <span className="text-xs text-green-700 font-medium">
                {facility.distance_km.toFixed(1)} km away
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
