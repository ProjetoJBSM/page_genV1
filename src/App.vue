<script setup>
import { ref, computed } from 'vue'
import Step1Input from './components/Step1Input.vue'
import Step2ColumnSelection from './components/Step2ColumnSelection.vue'
import Step3AddColumns from './components/Step3AddColumns.vue'
import Step4Output from './components/Step4Output.vue'
import Step5Process from './components/Step5Process.vue'

// State management
const currentStep = ref(1)
const inputData = ref(null)
const csvColumns = ref([])
const csvParsedData = ref([])
const csvSampleData = ref({})
const selectedColumns = ref([])
const columnState = ref([])  // Persistent column order/selection/renames
const sanitizeOptions = ref({})
const newColumns = ref([])
const outputConfig = ref(null)

// Step configuration
const steps = [
  { number: 1, label: 'Entrada', icon: '📥' },
  { number: 2, label: 'Colunas', icon: '📋' },
  { number: 3, label: 'Adicionar', icon: '➕' },
  { number: 4, label: 'Saída', icon: '⚙️' },
  { number: 5, label: 'Processar', icon: '🚀' }
]

// Computed properties for summaries
const inputSummary = computed(() => {
  if (!inputData.value) return 'Não configurado'
  if (inputData.value.type === 'csv') {
    return `Arquivo CSV: ${inputData.value.fileName}`
  } else {
    return 'Google Sheets URL'
  }
})

const outputSummary = computed(() => {
  if (!outputConfig.value) return 'Não configurado'
  if (outputConfig.value.outputType === 'download') {
    return `Download: ${outputConfig.value.downloadConfig.fileName}`
  } else {
    return 'Google Sheets'
  }
})

// Navigation methods
const nextStep = () => {
  if (currentStep.value < 5) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

const goToStep = (stepNumber) => {
  // Only allow going back or to the next step
  if (stepNumber <= currentStep.value + 1) {
    currentStep.value = stepNumber
  }
}

// Event handlers
const handleDataLoaded = (data) => {
  console.log('🎯 App.vue recebeu dados:', data)
  inputData.value = data
  
  // Reset all state when new data is loaded
  columnState.value = []
  selectedColumns.value = []
  newColumns.value = []
  sanitizeOptions.value = {}
  outputConfig.value = null
  
  // Extract columns and data
  if (data.columns && data.columns.length > 0) {
    csvColumns.value = data.columns
    csvParsedData.value = data.data || []
    
    // Create sample data object (first row for preview)
    if (csvParsedData.value.length > 0) {
      csvSampleData.value = csvParsedData.value[0]
    }
    
    console.log('✅ Colunas extraídas:', csvColumns.value)
    console.log('✅ Total de linhas:', csvParsedData.value.length)
    console.log('✅ Dados de exemplo:', csvSampleData.value)
    console.log('🔄 Estado resetado para novo arquivo')
  }
}

const handleColumnSelection = (selection) => {
  selectedColumns.value = selection.columns
  columnState.value = selection.columnOrder  // Store full column state
  sanitizeOptions.value = selection.sanitizeOptions
}

const handleNewColumns = (columns) => {
  newColumns.value = columns
}

const handleOutputConfig = (config) => {
  outputConfig.value = config
}

const handleProcess = () => {
  console.log('🔄 Processando dados...')
  console.log('📊 Dados originais:', csvParsedData.value.length, 'linhas')
  console.log('📋 Colunas selecionadas:', selectedColumns.value)
  console.log('🧹 Opções de sanitização:', sanitizeOptions.value)
  console.log('➕ Novas colunas:', newColumns.value)
}

// Check if step can be accessed
const canAccessStep = (stepNumber) => {
  return stepNumber <= currentStep.value + 1
}

// Computed property for processed data
const processedData = computed(() => {
  if (!csvParsedData.value || csvParsedData.value.length === 0) return []
  
  let data = [...csvParsedData.value]
  
  // Apply sanitization
  if (sanitizeOptions.value.removeEmptyRows) {
    data = data.filter(row => {
      return Object.values(row).some(val => val && val.toString().trim())
    })
  }
  
  if (sanitizeOptions.value.trimWhitespace) {
    data = data.map(row => {
      const trimmed = {}
      Object.keys(row).forEach(key => {
        trimmed[key] = row[key] ? row[key].toString().trim() : ''
      })
      return trimmed
    })
  }
  
  if (sanitizeOptions.value.removeDuplicates) {
    const seen = new Set()
    data = data.filter(row => {
      const key = JSON.stringify(row)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  
  // Add new columns FIRST (while all original columns are still available for formulas)
  if (newColumns.value && newColumns.value.length > 0) {
    // Create a mapping from displayName to originalName for formula lookups
    const displayToOriginalMap = {}
    if (columnState.value && columnState.value.length > 0) {
      columnState.value.forEach(col => {
        displayToOriginalMap[col.displayName] = col.originalName
      })
    }
    
    data = data.map((row, index) => {
      const enhanced = { ...row }
      newColumns.value.forEach(col => {
        if (!col.name) return
        
        switch (col.valueType) {
          case 'fixed':
            enhanced[col.name] = col.value || ''
            break
          case 'sequence':
            const seqValue = (col.sequenceStart || 1) + index
            // Apply padding if specified
            if (col.sequencePadding && col.sequencePadding > 0) {
              enhanced[col.name] = seqValue.toString().padStart(col.sequencePadding, '0')
            } else {
              enhanced[col.name] = seqValue
            }
            break
          case 'date':
            const now = new Date()
            switch (col.dateFormat) {
              case 'yyyy-mm-dd':
                enhanced[col.name] = now.toISOString().split('T')[0]
                break
              case 'dd/mm/yyyy':
                enhanced[col.name] = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
                break
              case 'mm/dd/yyyy':
                enhanced[col.name] = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`
                break
              default:
                enhanced[col.name] = now.toISOString()
            }
            break
          case 'formula':
            // Formula replacement: {columnName} gets replaced with column value
            // Supports functions like {padLeft(columnName, length)}
            let formula = col.formula || ''
            
            // Handle padLeft function: {padLeft(columnName, length)}
            const padLeftRegex = /\{padLeft\(([^,]+),\s*(\d+)\)\}/g
            formula = formula.replace(padLeftRegex, (match, colName, length) => {
              const trimmedColName = colName.trim()
              let value = ''
              
              // Try to find value using same strategy as regular columns
              if (row[trimmedColName] !== undefined) {
                value = row[trimmedColName]
              } else if (displayToOriginalMap[trimmedColName] && row[displayToOriginalMap[trimmedColName]] !== undefined) {
                value = row[displayToOriginalMap[trimmedColName]]
              }
              
              // Convert to string and pad
              return String(value || '').padStart(parseInt(length), '0')
            })
            
            // Regular formula processing
            
            // Find all {columnName} patterns
            const matches = formula.match(/\{([^}]+)\}/g)
            if (matches) {
              matches.forEach(match => {
                const colName = match.slice(1, -1).trim()
                
                // Try to find the value: first try direct match, then try display->original mapping
                let value = ''
                if (row[colName] !== undefined) {
                  value = row[colName]
                } else if (displayToOriginalMap[colName] && row[displayToOriginalMap[colName]] !== undefined) {
                  value = row[displayToOriginalMap[colName]]
                }
                
                // Replace the {columnName} with the actual value
                formula = formula.replace(match, value)
              })
            }
            
            enhanced[col.name] = formula
            break
          case 'ai':
            // AI columns are marked for later processing (async)
            // Initially set to empty, will be filled by AI in Step 5
            enhanced[col.name] = ''
            break
        }
      })
      return enhanced
    })
  }
  
  // Filter to selected columns only and rename them (AFTER formulas have been processed)
  if (selectedColumns.value && selectedColumns.value.length > 0) {
    data = data.map(row => {
      const filtered = {}
      
      // Add selected columns with their renamed displayNames
      selectedColumns.value.forEach(col => {
        // Access data using originalName, but store with displayName
        filtered[col.displayName] = row[col.originalName]
      })
      
      // Add new columns (they were already added above, just need to keep them)
      if (newColumns.value && newColumns.value.length > 0) {
        newColumns.value.forEach(col => {
          if (col.name && row[col.name] !== undefined) {
            filtered[col.name] = row[col.name]
          }
        })
      }
      
      return filtered
    })
  }
  
  console.log('✅ Dados processados:', data.length, 'linhas')
  return data
})

// Computed property for FULL data (before column filtering) - needed for AI prompts
const fullProcessedData = computed(() => {
  if (!csvParsedData.value || csvParsedData.value.length === 0) return []
  
  let data = [...csvParsedData.value]
  
  // Apply sanitization
  if (sanitizeOptions.value.removeEmptyRows) {
    data = data.filter(row => {
      return Object.values(row).some(val => val && val.toString().trim())
    })
  }
  
  if (sanitizeOptions.value.trimWhitespace) {
    data = data.map(row => {
      const trimmed = {}
      Object.keys(row).forEach(key => {
        trimmed[key] = row[key] ? row[key].toString().trim() : ''
      })
      return trimmed
    })
  }
  
  if (sanitizeOptions.value.removeDuplicates) {
    const seen = new Set()
    data = data.filter(row => {
      const key = JSON.stringify(row)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  
  // Add formula/sequence/date columns (but NOT AI columns yet)
  if (newColumns.value && newColumns.value.length > 0) {
    const displayToOriginalMap = {}
    if (columnState.value && columnState.value.length > 0) {
      columnState.value.forEach(col => {
        displayToOriginalMap[col.displayName] = col.originalName
      })
    }
    
    data = data.map((row, index) => {
      const enhanced = { ...row }
      newColumns.value.forEach(col => {
        if (!col.name) return
        
        switch (col.valueType) {
          case 'fixed':
            enhanced[col.name] = col.value || ''
            break
          case 'sequence':
            const seqValue = (col.sequenceStart || 1) + index
            // Apply padding if specified
            if (col.sequencePadding && col.sequencePadding > 0) {
              enhanced[col.name] = seqValue.toString().padStart(col.sequencePadding, '0')
            } else {
              enhanced[col.name] = seqValue
            }
            break
          case 'date':
            const now = new Date()
            switch (col.dateFormat) {
              case 'yyyy-mm-dd':
                enhanced[col.name] = now.toISOString().split('T')[0]
                break
              case 'dd/mm/yyyy':
                enhanced[col.name] = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
                break
              case 'mm/dd/yyyy':
                enhanced[col.name] = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()}`
                break
              default:
                enhanced[col.name] = now.toISOString()
            }
            break
          case 'formula':
            // Formula replacement: {columnName} gets replaced with column value
            // Supports functions like {padLeft(columnName, length)}
            let formula = col.formula || ''
            
            // Handle padLeft function: {padLeft(columnName, length)}
            const padLeftRegex = /\{padLeft\(([^,]+),\s*(\d+)\)\}/g
            formula = formula.replace(padLeftRegex, (match, colName, length) => {
              const trimmedColName = colName.trim()
              let value = ''
              
              // Try to find value using same strategy as regular columns
              if (row[trimmedColName] !== undefined) {
                value = row[trimmedColName]
              } else if (displayToOriginalMap[trimmedColName] && row[displayToOriginalMap[trimmedColName]] !== undefined) {
                value = row[displayToOriginalMap[trimmedColName]]
              }
              
              // Convert to string and pad
              return String(value || '').padStart(parseInt(length), '0')
            })
            
            // Regular column replacement: {columnName}
            const matches = formula.match(/\{([^}]+)\}/g)
            if (matches) {
              matches.forEach(match => {
                const colName = match.slice(1, -1).trim()
                let value = ''
                if (row[colName] !== undefined) {
                  value = row[colName]
                } else if (displayToOriginalMap[colName] && row[displayToOriginalMap[colName]] !== undefined) {
                  value = row[displayToOriginalMap[colName]]
                }
                formula = formula.replace(match, value)
              })
            }
            enhanced[col.name] = formula
            break
          case 'ai':
            // AI columns initialized as empty
            enhanced[col.name] = ''
            break
        }
      })
      return enhanced
    })
  }
  
  // Return ALL columns (no filtering) - AI processing needs access to everything
  console.log('✅ Dados completos (sem filtro):', data.length, 'linhas')
  return data
})

const outputFileName = computed(() => {
  if (outputConfig.value?.downloadConfig?.fileName) {
    return outputConfig.value.downloadConfig.fileName
  }
  return inputData.value?.fileName?.replace('.csv', '_processado.csv') || 'dados_processados.csv'
})
</script>

<template>
  <div class="app-container" :class="{ 'step1-bg': currentStep === 1 }">
    <!-- Hero Section for Step 1 -->
    <div v-if="currentStep === 1" class="hero-section">
      <h1 class="hero-title">Gerador de CSV</h1>
      <p class="hero-subtitle">Processe e transforme seus dados CSV de forma inteligente</p>
    </div>

    <!-- Header for other steps -->
    <div v-else class="header-section">
      <h1 class="app-title">Gerador de CSV</h1>
    </div>

    <!-- Main Content -->
    <div class="main-layout" :class="{ 'step1-layout': currentStep === 1 }">
      <div class="content-wrapper">
        <div class="step-content">
          <!-- Step Components -->
          <Transition name="slide-fade" mode="out-in">
            <Step1Input 
              v-if="currentStep === 1"
              @data-loaded="handleDataLoaded"
              @next="nextStep"
            />
            <Step2ColumnSelection 
              v-else-if="currentStep === 2"
              :columns="csvColumns"
              :sampleData="csvSampleData"
              :csvData="csvParsedData"
              :savedColumnState="columnState"
              @update:selection="handleColumnSelection"
              @next="nextStep"
              @prev="prevStep"
            />
            <Step3AddColumns 
              v-else-if="currentStep === 3"
              :sampleRow="csvSampleData"
              :columnState="columnState"
              :savedNewColumns="newColumns"
              @update:columns="handleNewColumns"
              @next="nextStep"
              @prev="prevStep"
            />
            <Step4Output 
              v-else-if="currentStep === 4"
              @update:config="handleOutputConfig"
              @next="nextStep"
              @prev="prevStep"
            />
            <Step5Process 
              v-else-if="currentStep === 5"
              :inputSummary="inputSummary"
              :selectedColumnsCount="selectedColumns.length"
              :newColumnsCount="newColumns.length"
              :outputSummary="outputSummary"
              :fullData="fullProcessedData"
              :processedData="processedData"
              :selectedColumns="selectedColumns"
              :fileName="outputFileName"
              :newColumns="newColumns"
              :columnState="columnState"
              @process="handleProcess"
              @prev="prevStep"
            />
          </Transition>
        </div>
      </div>
    </div>

    <!-- Footer Navigation -->
    <div class="fixed-footer">
      <div class="footer-content">
        <div class="footer-left">
          <button 
            v-if="currentStep > 1" 
            type="button" 
            class="nav-btn secondary" 
            @click="prevStep"
          >
            ← Anterior
          </button>
        </div>

        <div class="footer-center">
          <div class="stepper">
            <div 
              v-for="step in steps" 
              :key="step.number" 
              class="step-item" 
              :class="{
                'active': currentStep === step.number,
                'completed': currentStep > step.number,
                'disabled': !canAccessStep(step.number)
              }"
              @click="canAccessStep(step.number) && goToStep(step.number)"
            >
              <div class="step-circle">
                <span v-if="currentStep > step.number">✓</span>
                <span v-else-if="currentStep === step.number" v-html="step.icon"></span>
                <span v-else>{{ step.number }}</span>
              </div>
              <div class="step-label">{{ step.label }}</div>
            </div>
          </div>
        </div>

        <div class="footer-right">
          <button 
            v-if="currentStep < 5" 
            type="button" 
            class="nav-btn primary" 
            @click="nextStep"
          >
            Próximo →
          </button>
          <button 
            v-else 
            type="button" 
            class="nav-btn primary" 
            @click="currentStep = 1"
          >
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  position: relative;
}

.app-container.step1-bg {
  background: linear-gradient(135deg, #4360e3 0%, #000231 100%);
}

.app-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  background: linear-gradient(135deg, #4360e3 0%, #000231 100%);
  opacity: 0.1;
  z-index: 0;
  pointer-events: none;
}

.app-container.step1-bg::before {
  display: none;
}

/* Hero Section */
.hero-section {
  text-align: center;
  padding: 2rem 2rem 1.5rem;
  animation: fadeIn 0.8s ease-out;
  z-index: 1;
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 800;
  color: white;
  margin-bottom: 0.75rem;
  letter-spacing: -1px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.hero-subtitle {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 400;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Header Section */
.header-section {
  padding: 1.5rem 2rem;
  text-align: center;
  z-index: 1;
}

.app-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #2c3e50;
}

/* Main Layout */
.main-layout {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 1rem 2rem;
  overflow-y: auto;
  z-index: 1;
}

.main-layout.step1-layout {
  align-items: center;
}

.content-wrapper {
  width: 100%;
  max-width: 1400px;
}

.step-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  min-height: 400px;
}

.main-layout.step1-layout .step-content {
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

/* Transitions */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateX(20px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}

/* Footer */
.fixed-footer {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-top: 1px solid #e0e0e0;
  padding: 1rem 2rem;
  box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.05);
  z-index: 10;
}

.app-container.step1-bg .fixed-footer {
  background: transparent;
  border-top: none;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 3fr 1fr;
  align-items: center;
  gap: 1rem;
}

.footer-left {
  display: flex;
  justify-content: flex-start;
}

.footer-center {
  display: flex;
  justify-content: center;
}

.footer-right {
  display: flex;
  justify-content: flex-end;
}

/* Navigation Buttons */
.nav-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s;
}

.nav-btn.primary {
  background: linear-gradient(135deg, #4360e3 0%, #000231 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(67, 96, 227, 0.3);
}

.nav-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(67, 96, 227, 0.4);
}

.nav-btn.secondary {
  background: white;
  color: #4360e3;
  border: 2px solid #4360e3;
}

.nav-btn.secondary:hover {
  background: #f8f9ff;
}

/* Stepper */
.stepper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  position: relative;
}

.stepper::before {
  content: '';
  position: absolute;
  top: 25px;
  left: 0;
  right: 0;
  height: 4px;
  background: #e5e7eb;
  z-index: 0;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  position: relative;
  z-index: 1;
  transition: transform 0.2s;
}

.step-item:hover:not(.disabled) {
  transform: translateY(-2px);
}

.step-item.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.step-circle {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: white;
  border: 3px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 20px;
  color: #9ca3af;
  transition: all 0.3s;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
}

.step-item.active .step-circle {
  background: linear-gradient(135deg, #4360e3 0%, #000231 100%);
  color: white;
  border-color: transparent;
  box-shadow: 0 6px 20px rgba(67, 96, 227, 0.4);
}

.step-item.completed .step-circle {
  background: #28a745;
  color: white;
  border-color: transparent;
}

.step-label {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: #666;
  text-align: center;
}

.app-container.step1-bg .step-label {
  color: white;
}

.step-item.active .step-label {
  color: #111;
  font-weight: 600;
}

.app-container.step1-bg .step-item.active .step-label {
  color: white;
  font-weight: 700;
}
</style>
