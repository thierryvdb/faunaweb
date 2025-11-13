<template>
  <div class="qp-wrapper">
    <div class="qp-heading">
      <div class="axis-label">Linha</div>
      <div class="axis-label">Coluna</div>
    </div>
    <div class="qp-canvas" :style="canvasStyle">
      <div class="qp-axis qp-axis-left">
        <span v-for="row in rows" :key="`left-${row}`">{{ row }}</span>
      </div>
      <div class="qp-grid">
        <button
          v-for="cell in cells"
          :key="cell.code"
          class="qp-cell"
          :class="{ selecionado: cell.code === selected }"
          type="button"
          :title="cell.code"
          @click="selecionar(cell)"
        ></button>
      </div>
      <div class="qp-axis qp-axis-right">
        <span v-for="row in rows" :key="`right-${row}`">{{ row }}</span>
      </div>
      <div class="qp-axis qp-axis-top">
        <span v-for="col in cols" :key="`top-${col}`">{{ col }}</span>
      </div>
      <div class="qp-axis qp-axis-bottom">
        <span v-for="col in cols" :key="`bottom-${col}`">{{ col }}</span>
      </div>
    </div>
    <p class="qp-dica">
      Clique em qualquer célula para preencher o quadrante. Configure a imagem e os limites geográficos em
      <code>src/config/quadrantGrid.ts</code>.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { QUADRANT_COLUMNS, QUADRANT_MAP, QUADRANT_ROWS, type QuadrantSelection } from '@/config/quadrantGrid';

const props = defineProps<{
  selected?: string | null;
}>();

const emit = defineEmits<{
  (event: 'select', payload: QuadrantSelection): void;
}>();

const rows = QUADRANT_ROWS;
const cols = QUADRANT_COLUMNS;

const mapImage = QUADRANT_MAP.imageUrl;
const mapRatio = QUADRANT_MAP.aspectRatio ?? cols.length / rows.length;

const canvasStyle = computed(() => ({
  backgroundImage: `url(${mapImage})`,
  '--qp-ratio': `${mapRatio}`
}));

const cells = computed(() =>
  rows.flatMap((row, rowIdx) =>
    cols.map((col, colIdx) => ({
      code: `${row}${col}`,
      rowIdx,
      colIdx
    }))
  )
);

const selected = computed(() => props.selected ?? '');

function selecionar(cell: { code: string; rowIdx: number; colIdx: number }) {
  const coords = calcularCoordenadas(cell.rowIdx, cell.colIdx);
  emit('select', {
    quadrant: cell.code,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null
  });
}

function calcularCoordenadas(rowIdx: number, colIdx: number) {
  if (!QUADRANT_MAP.bounds) {
    return null;
  }
  const totalRows = rows.length;
  const totalCols = cols.length;
  const { topLeft, bottomRight } = QUADRANT_MAP.bounds;
  const latSpan = topLeft.lat - bottomRight.lat;
  const lonSpan = bottomRight.lon - topLeft.lon;
  const lat = topLeft.lat - ((rowIdx + 0.5) / totalRows) * latSpan;
  const lon = topLeft.lon + ((colIdx + 0.5) / totalCols) * lonSpan;
  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lon.toFixed(6))
  };
}
</script>

<style scoped>
.qp-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.qp-heading {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #475569;
}

.qp-canvas {
  position: relative;
  background-size: cover;
  background-position: center;
  border: 1px solid #94a3b8;
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: var(--qp-ratio, 2.35);
}

.qp-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(33, minmax(0, 1fr));
  grid-template-rows: repeat(14, minmax(0, 1fr));
}

.qp-cell {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  transition: background 0.1s ease;
}

.qp-cell:hover {
  background: rgba(14, 165, 233, 0.15);
}

.qp-cell.selecionado {
  background: rgba(14, 165, 233, 0.3);
  box-shadow: inset 0 0 0 2px rgba(15, 23, 42, 0.4);
}

.qp-axis {
  position: absolute;
  pointer-events: none;
  font-size: 0.65rem;
  color: #0f172a;
  display: flex;
  font-weight: 600;
}

.qp-axis-left,
.qp-axis-right {
  top: 0;
  bottom: 0;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.25rem 0.4rem;
}

.qp-axis-left {
  left: 0;
}

.qp-axis-right {
  right: 0;
}

.qp-axis-top,
.qp-axis-bottom {
  left: 0;
  right: 0;
  justify-content: space-between;
  padding: 0.2rem 0.4rem;
}

.qp-axis-top {
  top: 0;
}

.qp-axis-bottom {
  bottom: 0;
}

.qp-dica {
  font-size: 0.75rem;
  color: #475569;
  margin: 0;
}
</style>
