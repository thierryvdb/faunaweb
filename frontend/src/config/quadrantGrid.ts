export const QUADRANT_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
export const QUADRANT_COLUMNS = Array.from({ length: 33 }, (_, idx) => idx + 1);

export const QUADRANT_MAP = {
  imageUrl: import.meta.env.VITE_QUADRANT_MAP_URL ?? '/quadrant-grid-placeholder.png',
  aspectRatio: 33 / 14,
  bounds: null,
};

export type QuadrantSelection = {
  quadrant: string;
  latitude: number | null;
  longitude: number | null;
};
