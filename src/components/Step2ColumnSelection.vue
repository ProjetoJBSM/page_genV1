<template>
  <div class="step-container">
    <h2>Etapa 2: Seleção de Colunas</h2>
    <p class="step-description">Marque as colunas que deseja manter. Clique nos botões ↑↓ para reordenar.</p>
    
    <div class="selection-controls">
      <button type="button" class="control-btn" @click="selectAll">✓ Selecionar Todas</button>
      <button type="button" class="control-btn" @click="deselectAll">✗ Desmarcar Todas</button>
    </div>

    <!-- CSV Data Preview with Column Selection -->
    <div v-if="csvData.length > 0" class="csv-preview-section">
      <div class="selection-summary">
        <strong>{{ orderedColumns.filter(c => c.selected).length }}</strong> de <strong>{{ orderedColumns.length }}</strong> colunas selecionadas
      </div>
      
      <p class="preview-info">Mostrando {{ Math.min(10, csvData.length) }} de {{ csvData.length }} linhas</p>
      
      <div class="table-wrapper">
        <table class="csv-table">
          <thead>
            <tr>
              <th v-for="(col, index) in orderedColumns" 
                  :key="col.originalName" 
                  :class="['table-header', { 'column-disabled': !col.selected }]">
                <div class="header-content">
                  <label class="checkbox-container">
                    <input 
                      type="checkbox" 
                      v-model="col.selected"
                      @change="updateSelection"
                      class="column-checkbox"
                    />
                    <input 
                      type="text"
                      v-model="col.displayName"
                      @change="updateSelection"
                      class="column-name-input"
                      :title="'Renomear coluna (nome original: ' + col.originalName + ')'"
                    />
                  </label>
                  <div class="reorder-buttons">
                    <button 
                      type="button" 
                      class="reorder-btn" 
                      @click="moveColumn(index, -1)"
                      :disabled="index === 0"
                      title="Mover para esquerda"
                    >←</button>
                    <button 
                      type="button" 
                      class="reorder-btn" 
                      @click="moveColumn(index, 1)"
                      :disabled="index === orderedColumns.length - 1"
                      title="Mover para direita"
                    >→</button>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in previewData" :key="index" class="table-row">
              <td v-for="col in orderedColumns" 
                  :key="col.originalName" 
                  :class="['table-cell', { 'cell-disabled': !col.selected }]">
                {{ row[col.originalName] || '' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="sanitization-options">
      <h3>Opções de Sanitização</h3>
      <label class="option-label">
        <input type="checkbox" v-model="sanitizeOptions.removeEmptyRows" />
        <span>Remover linhas vazias</span>
      </label>
      <label class="option-label">
        <input type="checkbox" v-model="sanitizeOptions.trimWhitespace" />
        <span>Remover espaços extras</span>
      </label>
      <label class="option-label">
        <input type="checkbox" v-model="sanitizeOptions.removeDuplicates" />
        <span>Remover linhas duplicadas</span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  columns: {
    type: Array,
    default: () => []
  },
  sampleData: {
    type: Object,
    default: () => ({})
  },
  csvData: {
    type: Array,
    default: () => []
  },
  savedColumnState: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:selection', 'next', 'prev'])

// Create ordered columns with selection state
// Use savedColumnState if available (for persistence), otherwise initialize from props.columns
const orderedColumns = ref(
  props.savedColumnState && props.savedColumnState.length > 0
    ? props.savedColumnState
    : props.columns.map(col => ({ 
        originalName: col, 
        displayName: col, 
        selected: true 
      }))
)

const sanitizeOptions = ref({
  removeEmptyRows: true,
  trimWhitespace: true,
  removeDuplicates: false
})

// Computed property for preview data (show first 10 rows)
const previewData = computed(() => {
  return props.csvData.slice(0, 10)
})

const selectAll = () => {
  orderedColumns.value.forEach(col => col.selected = true)
  updateSelection()
}

const deselectAll = () => {
  orderedColumns.value.forEach(col => col.selected = false)
  updateSelection()
}

// Move column position
const moveColumn = (index, direction) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= orderedColumns.value.length) return
  
  const temp = orderedColumns.value[index]
  orderedColumns.value[index] = orderedColumns.value[newIndex]
  orderedColumns.value[newIndex] = temp
  
  // Force reactivity
  orderedColumns.value = [...orderedColumns.value]
  updateSelection()
}

const updateSelection = () => {
  emitUpdate()
}

const emitUpdate = () => {
  const selected = orderedColumns.value
    .filter(col => col.selected)
    .map(col => ({
      originalName: col.originalName,
      displayName: col.displayName
    }))
  
  emit('update:selection', {
    columns: selected,
    columnOrder: orderedColumns.value.map(col => ({
      originalName: col.originalName,
      displayName: col.displayName
    })),
    sanitizeOptions: sanitizeOptions.value
  })
}

// Watch for changes and emit
watch([orderedColumns, sanitizeOptions], emitUpdate, { deep: true })
</script>

<style scoped>
.step-container {
  padding: 2rem;
  margin: 0 auto;
}

h2 {
  font-size: 1.8rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

h3 {
  font-size: 1.3rem;
  color: #2c3e50;
  margin-bottom: 1rem;
}

.step-description {
  color: #666;
  margin-bottom: 2rem;
}

.selection-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.control-btn {
  padding: 0.5rem 1rem;
  background-color: #4360e3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.control-btn:hover {
  background-color: #3550d0;
  transform: translateY(-1px);
}

.sanitization-options {
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  cursor: pointer;
  font-size: 1rem;
}

.option-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.selection-summary {
  padding: 1rem;
  background-color: #e7f3ff;
  border-left: 4px solid #4360e3;
  border-radius: 4px;
  text-align: center;
  font-size: 1.1rem;
}

/* CSV Preview Section */
.csv-preview-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #e0e0e0;
}

.csv-preview-section h3 {
  font-size: 1.3rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.preview-info {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.csv-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  font-size: 0.9rem;
}

.table-header {
  background:#20317e;
  color: white;
  padding: 0.75rem;
  text-align: left;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
  white-space: nowrap;
}

.table-row {
  transition: background-color 0.2s;
}

.table-row:nth-child(even) {
  background-color: #f8f9fa;
}

.table-row:hover {
  background-color: #e7f3ff;
}

.table-cell {
  padding: 0.75rem;
  border-bottom: 1px solid #e0e0e0;
  color: #2c3e50;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
