import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export function useAllFacilities() {
  return useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.listFacilities(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchFacilities(q: string) {
  return useQuery({
    queryKey: ["facilities", "search", q],
    queryFn: () => api.searchFacilities(q),
    enabled: q.trim().length > 0,
  });
}

export function useFacilitiesByProvince(province: string) {
  return useQuery({
    queryKey: ["facilities", "province", province],
    queryFn: () => api.facilitiesByProvince(province),
    enabled: province !== "All" && province.length > 0,
  });
}

export function useFacilitiesBySpecialty(specialty: string) {
  return useQuery({
    queryKey: ["facilities", "specialty", specialty],
    queryFn: () => api.facilitiesBySpecialty(specialty),
    enabled: specialty !== "All" && specialty.length > 0,
  });
}

export function useNearbyFacilities(
  lat: number | null,
  lon: number | null,
  radiusKm = 50
) {
  return useQuery({
    queryKey: ["facilities", "nearby", lat, lon, radiusKm],
    queryFn: () => api.nearbyFacilities(lat!, lon!, radiusKm),
    enabled: lat !== null && lon !== null,
  });
}

export function useUpdateFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { verification_status?: string; latitude?: number; longitude?: number };
    }) => api.updateFacility(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facilities"] });
    },
  });
}
