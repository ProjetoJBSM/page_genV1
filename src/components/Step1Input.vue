<template>
  <div class="step-container">
    <h2>Etapa 1: Entrada de Dados</h2>
    <p class="step-description">Forneça o arquivo CSV ou URL do Google Sheets</p>
    
    <div class="input-options">
      <!-- CSV File Upload -->
      <div class="input-group">
        <label class="input-label">
          <input type="radio" v-model="inputType" value="csv" />
          <span>Carregar arquivo CSV</span>
        </label>
        
        <div v-if="inputType === 'csv'" class="input-content">
          <div class="file-input-wrapper">
            <button type="button" class="file-select-btn" @click="$refs.csvFileInput.click()">
              📁 Escolher arquivo CSV
            </button>
            <input 
              ref="csvFileInput" 
              type="file" 
              accept=".csv" 
              @change="handleCsvUpload"
              style="display: none;" 
            />
            <span class="file-name">{{ csvFileName || 'Nenhum arquivo selecionado' }}</span>
          </div>
          
          <div v-if="csvData.length > 0" class="csv-preview">
            <p><strong>{{ csvData.length }}</strong> linhas carregadas</p>
          </div>
        </div>
      </div>

      <!-- Google Sheets URL -->
      <div class="input-group">
        <label class="input-label">
          <input type="radio" v-model="inputType" value="sheets" />
          <span>URL do Google Sheets</span>
        </label>
        
        <div v-if="inputType === 'sheets'" class="input-content">
          <input 
            v-model="sheetsUrl" 
            type="text" 
            class="sheets-input"
            placeholder="Cole a URL do Google Sheets aqui..."
          />
          <p class="hint">A URL será automaticamente convertida para exportar como CSV</p>
          <button 
            type="button" 
            class="load-btn" 
            @click="loadFromSheets"
            :disabled="!sheetsUrl || isLoading"
          >
            {{ isLoading ? 'Carregando...' : 'Carregar Dados' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Papa from 'papaparse'

const emit = defineEmits(['next', 'data-loaded'])

const inputType = ref('csv')
const csvFileName = ref('')
const csvData = ref([])
const sheetsUrl = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const handleCsvUpload = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  
  console.log('📄 CSV Upload iniciado:', file.name)
  
  // Clear previous data immediately
  csvFileName.value = file.name
  csvData.value = []
  errorMessage.value = ''
  
  try {
    // Read file with encoding detection
    let text = ''
    
    // Try to detect encoding by checking first bytes for BOM
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Check for UTF-8 BOM (EF BB BF)
    if (uint8Array.length >= 3 && uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
      console.log('🔍 Detectado UTF-8 BOM')
      // Decode as UTF-8 and remove BOM
      const decoder = new TextDecoder('utf-8')
      text = decoder.decode(uint8Array.slice(3))
    } else {
      // Try UTF-8 first
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        text = decoder.decode(uint8Array)
        console.log('🔍 Lido como UTF-8')
      } catch (e) {
        // If UTF-8 fails, try Windows-1252 (common for Excel)
        console.log('🔍 UTF-8 falhou, tentando Windows-1252')
        const decoder = new TextDecoder('windows-1252')
        text = decoder.decode(uint8Array)
      }
    }
    
    console.log('📄 Arquivo lido, tamanho:', text.length, 'caracteres')
    
    // Parse CSV with PapaCSV (auto-detects delimiter: comma, semicolon, tab, etc.)
    Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy',
      // delimiter auto-detected by PapaCSV
      quoteChar: '"',
      escapeChar: '"',
      dynamicTyping: false,  // Keep all values as strings to preserve formatting
      trimHeaders: true,
      complete: (results) => {
        console.log('✅ CSV parseado com sucesso')
        console.log('📊 Delimitador detectado:', results.meta.delimiter === ',' ? 'vírgula (,)' : results.meta.delimiter === ';' ? 'ponto e vírgula (;)' : results.meta.delimiter === '\t' ? 'tab' : results.meta.delimiter)
        console.log('📊 Colunas encontradas:', results.meta.fields)
        console.log('📊 Total de colunas:', results.meta.fields.length)
        console.log('📊 Total de linhas:', results.data.length)
        console.log('📊 Primeiras 3 linhas:', results.data.slice(0, 3))
        console.log('📊 Primeira linha completa:', JSON.stringify(results.data[0], null, 2))
        console.log('📊 Erros do parser:', results.errors)
        
        // Fix incorrectly split quoted fields
        const fixedData = results.data.map(row => {
          const columnNames = results.meta.fields
          const values = columnNames.map(col => row[col])
          
          // Process values to merge split quoted fields
          const mergedValues = []
          let i = 0
          
          while (i < values.length) {
            const val = values[i]
            if (typeof val === 'string') {
              const trimmed = val.trim()
              
              // Check if this value starts with quote but doesn't end with one
              if (trimmed.startsWith('"') && !trimmed.endsWith('"')) {
                // Look ahead to find the closing quote
                let merged = val
                let j = i + 1
                
                while (j < values.length) {
                  merged += ',' + values[j]
                  if (typeof values[j] === 'string' && values[j].trim().endsWith('"')) {
                    // Found the closing quote, stop here
                    mergedValues.push(merged)
                    i = j + 1
                    break
                  }
                  j++
                }
                
                // If we didn't find a closing quote, just add as-is
                if (j >= values.length) {
                  mergedValues.push(val)
                  i++
                }
              } else {
                // Normal value, just add it
                mergedValues.push(val)
                i++
              }
            } else {
              mergedValues.push(val)
              i++
            }
          }
          
          // Rebuild the row object with merged values
          const fixed = {}
          for (let idx = 0; idx < Math.min(columnNames.length, mergedValues.length); idx++) {
            let value = mergedValues[idx]
            
            // Strip quotes from fully quoted values
            if (typeof value === 'string') {
              const trimmed = value.trim()
              if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                value = trimmed.slice(1, -1)
              }
            }
            
            fixed[columnNames[idx]] = value
          }
          
          return fixed
        })
        
        console.log('📊 Dados corrigidos, primeira linha:', JSON.stringify(fixedData[0], null, 2))
        
        // Handle missing/blank column names
        const processedFields = results.meta.fields.map((field, index) => {
          if (!field || field.trim() === '') {
            return `Column_${index + 1}`
          }
          return field
        })
        
        // Rename columns in data if needed
        const processedData = fixedData.map(row => {
          const newRow = {}
          results.meta.fields.forEach((oldName, index) => {
            const newName = processedFields[index]
            newRow[newName] = row[oldName]
          })
          return newRow
        })
        
        console.log('📊 Colunas processadas:', processedFields)
        
        csvData.value = processedData
        
        emit('data-loaded', { 
          type: 'csv', 
          data: processedData,
          columns: processedFields,
          fileName: file.name,
          rawText: text
        })
        
        // Reset file input to allow re-uploading the same file
        if (event.target) {
          event.target.value = ''
        }
      },
      error: (error) => {
        console.error('❌ Erro ao parsear CSV:', error)
        throw error
      }
    })
  } catch (error) {
    console.error('❌ Erro no upload do CSV:', error)
    errorMessage.value = 'Erro ao carregar arquivo CSV: ' + error.message
    // Reset file input on error too
    if (event.target) {
      event.target.value = ''
    }
  }
}

const loadFromSheets = async () => {
  if (!sheetsUrl.value) return
  
  console.log('🔗 Iniciando carregamento do Google Sheets')
  console.log('🔗 URL original:', sheetsUrl.value)
  
  // Clear previous data immediately
  csvData.value = []
  csvFileName.value = ''
  isLoading.value = true
  errorMessage.value = ''
  
  try {
    // Convert Google Sheets URL to CSV export URL
    let url = sheetsUrl.value
    
    // Extract spreadsheet ID and convert to export URL
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (!match) {
      console.error('❌ URL inválida - padrão não encontrado')
      throw new Error('URL do Google Sheets inválida')
    }
    
    const spreadsheetId = match[1]
    console.log('🔑 Spreadsheet ID extraído:', spreadsheetId)
    
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`
    console.log('📥 URL de exportação gerada:', exportUrl)
    
    // Fetch the CSV data from Google Sheets
    console.log('🌐 Fazendo requisição para o Google Sheets...')
    const response = await fetch(exportUrl)
    
    if (!response.ok) {
      console.error('❌ Resposta do servidor:', response.status, response.statusText)
      throw new Error(`Erro ao acessar o Google Sheets: ${response.status} ${response.statusText}`)
    }
    
    // Read response with encoding detection
    const arrayBuffer = await response.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    let text = ''
    // Check for UTF-8 BOM (EF BB BF)
    if (uint8Array.length >= 3 && uint8Array[0] === 0xEF && uint8Array[1] === 0xBB && uint8Array[2] === 0xBF) {
      console.log('🔍 Detectado UTF-8 BOM no Google Sheets')
      const decoder = new TextDecoder('utf-8')
      text = decoder.decode(uint8Array.slice(3))
    } else {
      // Google Sheets usually returns UTF-8, but fallback to Windows-1252 if needed
      try {
        const decoder = new TextDecoder('utf-8', { fatal: true })
        text = decoder.decode(uint8Array)
        console.log('🔍 Google Sheets lido como UTF-8')
      } catch (e) {
        console.log('🔍 UTF-8 falhou, tentando Windows-1252')
        const decoder = new TextDecoder('windows-1252')
        text = decoder.decode(uint8Array)
      }
    }
    
    console.log('✅ Dados recebidos, tamanho:', text.length, 'caracteres')
    
    // Parse the CSV data (auto-detects delimiter: comma, semicolon, tab, etc.)
    Papa.parse(text, {
      header: true,
      skipEmptyLines: 'greedy',
      // delimiter auto-detected by PapaCSV
      quoteChar: '"',
      escapeChar: '"',
      dynamicTyping: false,  // Keep all values as strings to preserve formatting
      trimHeaders: true,
      complete: (results) => {
        console.log('✅ Google Sheets CSV parseado com sucesso')
        console.log('📊 Delimitador detectado:', results.meta.delimiter === ',' ? 'vírgula (,)' : results.meta.delimiter === ';' ? 'ponto e vírgula (;)' : results.meta.delimiter === '\t' ? 'tab' : results.meta.delimiter)
        console.log('📊 Colunas encontradas:', results.meta.fields)
        console.log('📊 Total de linhas:', results.data.length)
        console.log('📊 Primeiras 3 linhas:', results.data.slice(0, 3))
        
        // Fix incorrectly split quoted fields
        const fixedData = results.data.map(row => {
          const columnNames = results.meta.fields
          const values = columnNames.map(col => row[col])
          
          // Process values to merge split quoted fields
          const mergedValues = []
          let i = 0
          
          while (i < values.length) {
            const val = values[i]
            if (typeof val === 'string') {
              const trimmed = val.trim()
              
              // Check if this value starts with quote but doesn't end with one
              if (trimmed.startsWith('"') && !trimmed.endsWith('"')) {
                // Look ahead to find the closing quote
                let merged = val
                let j = i + 1
                
                while (j < values.length) {
                  merged += ',' + values[j]
                  if (typeof values[j] === 'string' && values[j].trim().endsWith('"')) {
                    // Found the closing quote, stop here
                    mergedValues.push(merged)
                    i = j + 1
                    break
                  }
                  j++
                }
                
                // If we didn't find a closing quote, just add as-is
                if (j >= values.length) {
                  mergedValues.push(val)
                  i++
                }
              } else {
                // Normal value, just add it
                mergedValues.push(val)
                i++
              }
            } else {
              mergedValues.push(val)
              i++
            }
          }
          
          // Rebuild the row object with merged values
          const fixed = {}
          for (let idx = 0; idx < Math.min(columnNames.length, mergedValues.length); idx++) {
            let value = mergedValues[idx]
            
            // Strip quotes from fully quoted values
            if (typeof value === 'string') {
              const trimmed = value.trim()
              if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                value = trimmed.slice(1, -1)
              }
            }
            
            fixed[columnNames[idx]] = value
          }
          
          return fixed
        })
        
        // Handle missing/blank column names
        const processedFields = results.meta.fields.map((field, index) => {
          if (!field || field.trim() === '') {
            return `Column_${index + 1}`
          }
          return field
        })
        
        // Rename columns in data if needed
        const processedData = fixedData.map(row => {
          const newRow = {}
          results.meta.fields.forEach((oldName, index) => {
            const newName = processedFields[index]
            newRow[newName] = row[oldName]
          })
          return newRow
        })
        
        console.log('📊 Colunas processadas:', processedFields)
        
        csvData.value = processedData
        csvFileName.value = 'Google Sheets'
        
        emit('data-loaded', { 
          type: 'sheets', 
          data: processedData,
          columns: processedFields,
          url: exportUrl, 
          originalUrl: sheetsUrl.value,
          rawText: text
        })
      },
      error: (error) => {
        console.error('❌ Erro ao parsear CSV do Google Sheets:', error)
        throw error
      }
    })
    
  } catch (error) {
    errorMessage.value = 'Erro ao processar URL: ' + error.message
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.step-container {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

h2 {
  font-size: 1.8rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.step-description {
  color: #666;
  margin-bottom: 2rem;
}

.input-options {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.input-group {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.input-group:has(input[type="radio"]:checked) {
  border-color: #4360e3;
  background-color: #f8f9ff;
}

.input-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 1.1rem;
}

.input-label input[type="radio"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.input-content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e0e0e0;
}

.file-input-wrapper {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.file-select-btn {
  background-color: #4360e3;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.file-select-btn:hover {
  background-color: #3550d0;
}

.file-name {
  color: #666;
  font-size: 0.9rem;
}

.sheets-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.sheets-input:focus {
  outline: none;
  border-color: #4360e3;
}

.hint {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 1rem;
}

.load-btn {
  background-color: #4360e3;
  color: white;
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.load-btn:hover:not(:disabled) {
  background-color: #3550d0;
}

.load-btn:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.csv-preview {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #e7f3ff;
  border-left: 4px solid #4360e3;
  border-radius: 4px;
}

.error-message {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #ffe7e7;
  border-left: 4px solid #dc3545;
  border-radius: 4px;
  color: #dc3545;
}
</style>
