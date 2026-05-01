import { ChevronDown } from "lucide-react";
import { PROVINCES, type Province } from "../types";
import { cn } from "../lib/utils";

interface FiltersProps {
  province: Province;
  onProvinceChange: (p: Province) => void;
  className?: string;
}

export default function Filters({ province, onProvinceChange, className }: FiltersProps) {
  return (
    <div className={cn("relative", className)}>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1 block">
        Province
      </label>
      <div className="relative">
        <select
          value={province}
          onChange={(e) => onProvinceChange(e.target.value as Province)}
          className="w-full appearance-none pl-3 pr-8 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent cursor-pointer"
        >
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}
