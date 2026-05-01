export interface Facility {
  id: string;
  name: string;
  province: string;
  country: string;
  latitude: number;
  longitude: number;
  verification_status: "verified" | "unverified";
  coordinate_source: string;
  hospital_type: HospitalType;
  specialties: string;
  created_at: string;
}

export interface FacilityNearby extends Facility {
  distance_km: number;
}

export type HospitalType = "Teaching" | "Government" | "Community" | "Specialty" | "Private";

export const HOSPITAL_TYPE_COLORS: Record<HospitalType, string> = {
  Teaching:   "#7c3aed",
  Government: "#2563eb",
  Community:  "#0891b2",
  Specialty:  "#d97706",
  Private:    "#dc2626",
};

export const HOSPITAL_TYPE_LABELS: Record<HospitalType, string> = {
  Teaching:   "Teaching / Academic",
  Government: "Government",
  Community:  "Community",
  Specialty:  "Specialty",
  Private:    "Private",
};

export type Province =
  | "All"
  | "Province 1"
  | "Madhes"
  | "Bagmati"
  | "Gandaki"
  | "Lumbini"
  | "Karnali"
  | "Sudurpaschim";

export const PROVINCES: Province[] = [
  "All", "Province 1", "Madhes", "Bagmati",
  "Gandaki", "Lumbini", "Karnali", "Sudurpaschim",
];

export const SPECIALTIES = [
  "All",
  "Cancer",
  "Cardiac",
  "Dialysis",
  "Kidney",
  "Orthopedic",
  "Maternity",
  "Pediatric",
  "Neurology",
  "Trauma",
  "Transplant",
  "Spinal",
  "General",
] as const;

export type Specialty = (typeof SPECIALTIES)[number];
