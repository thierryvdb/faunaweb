import { ref } from 'vue';
import { ApiService } from '@/services/api';

const airports = ref<any[]>([]);
const species = ref<any[]>([]);
const lookups = ref<Record<string, any[]>>({});
const loadingReference = ref(false);
const loaded = ref(false);
const locationsCache = new Map<number, any[]>();

export function useReferenceData() {
  async function loadReferenceData(force = false) {
    if (loaded.value && !force) {
      return;
    }
    try {
      loadingReference.value = true;
      const [aeroportos, especies, lookupData] = await Promise.all([
        ApiService.getAirports(),
        ApiService.getSpecies(),
        ApiService.getLookups()
      ]);
      airports.value = aeroportos ?? [];
      species.value = especies ?? [];
      lookups.value = lookupData ?? {};
      loaded.value = true;
    } finally {
      loadingReference.value = false;
    }
  }

  async function getLocations(airportId: number) {
    if (!airportId) return [];
    if (locationsCache.has(airportId)) {
      return locationsCache.get(airportId) ?? [];
    }
    const data = await ApiService.getLocations(airportId);
    locationsCache.set(airportId, data ?? []);
    return data ?? [];
  }

  return {
    airports,
    species,
    lookups,
    loadingReference,
    loadReferenceData,
    getLocations
  };
}
