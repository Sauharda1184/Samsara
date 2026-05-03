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
  total_beds: number;
  available_beds: number;
  total_doctors: number;
  emergency_services: boolean;
  phone: string | null;
  established_year: number | null;
  accreditation: string;
  services: string;
  facility_category: string;
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

export const SERVICES = [
  "All",
  "ICU",
  "Laboratory",
  "X-ray",
  "Blood Bank",
  "Ambulance",
  "Surgery",
  "Pharmacy",
  "Maternity Ward",
  "Dialysis",
  "CT Scan",
  "MRI",
  "Physiotherapy",
] as const;

export type Service = (typeof SERVICES)[number];

export const FACILITY_CATEGORIES = ["All", "Hospital", "Healthpost", "Clinic"] as const;
export type FacilityCategory = (typeof FACILITY_CATEGORIES)[number];
