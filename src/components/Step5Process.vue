<template>
  <div class="step-container">
    <h2>Etapa 5: Processar e Exportar</h2>
    <p class="step-description">Revise as configurações e processe seus dados</p>
    
    <div class="summary-section">
      <h3>Resumo da Configuração</h3>
      
      <div class="summary-card">
        <div class="summary-item">
          <strong>Fonte de Dados:</strong>
          <span>{{ inputSummary }}</span>
        </div>
        
        <div class="summary-item">
          <strong>Colunas Selecionadas:</strong>
          <span>{{ selectedColumnsCount }} colunas</span>
        </div>
        
        <div class="summary-item">
          <strong>Novas Colunas:</strong>
          <span>{{ newColumnsCount }} colunas adicionadas</span>
        </div>
        
        <div class="summary-item">
          <strong>Saída:</strong>
          <span>{{ outputSummary }}</span>
        </div>
      </div>
    </div>

    <div class="process-section">
      <button 
        type="button" 
        class="process-btn" 
        @click="processData"
        :disabled="isProcessing"
      >
        <span v-if="!isProcessing">🚀 Processar e Exportar</span>
        <span v-else>
          <span class="spinner"></span>
          Processando...
        </span>
      </button>
    </div>

    <div v-if="processStatus" class="status-section">
      <div :class="['status-message', processStatus.type]">
        {{ processStatus.message }}
      </div>
      
      <div v-if="processStatus.type === 'success' && downloadUrl" class="download-section">
        <a :href="downloadUrl" :download="downloadFileName" class="download-link">
          📥 Download {{ downloadFileName }}
        </a>
      </div>
    </div>

    <div v-if="isProcessing" class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="progress-text">{{ progressText }}</p>
      
      <div v-if="queueStats.queued > 0 || queueStats.completed > 0" class="queue-stats">
        <div class="stat-item">
          <span class="stat-label">🌱 Plantas:</span>
          <span class="stat-value">{{ queueStats.plantsProcessed }}/{{ queueStats.totalPlants }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">💾 Cache:</span>
          <span class="stat-value">{{ queueStats.cached }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">📦 Lotes:</span>
          <span class="stat-value">{{ queueStats.completed }}</span>
        </div>
        <div class="stat-item" v-if="queueStats.errors > 0">
          <span class="stat-label">❌ Erros:</span>
          <span class="stat-value error">{{ queueStats.errors }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import Papa from 'papaparse'
import { RequestQueue } from '../services/requestQueue.js'
import { cacheManager } from '../services/cacheManager.js'

const props = defineProps({
  inputSummary: {
    type: String,
    default: 'Não configurado'
  },
  selectedColumnsCount: {
    type: Number,
    default: 0
  },
  newColumnsCount: {
    type: Number,
    default: 0
  },
  outputSummary: {
    type: String,
    default: 'Não configurado'
  },
  fullData: {
    type: Array,
    default: () => []
  },
  processedData: {
    type: Array,
    default: () => []
  },
  selectedColumns: {
    type: Array,
    default: () => []
  },
  fileName: {
    type: String,
    default: 'dados_processados.csv'
  },
  newColumns: {
    type: Array,
    default: () => []
  },
  columnState: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['process', 'prev'])

const isProcessing = ref(false)
const processStatus = ref(null)
const downloadUrl = ref('')
const downloadFileName = ref('')
const progress = ref(0)
const progressText = ref('')
const queueStats = ref({
  queued: 0,
  completed: 0,
  cached: 0,
  errors: 0,
  totalPlants: 0,
  plantsProcessed: 0
})

// Request queue instance
let requestQueue = null

// Session ID for progress tracking
const sessionId = ref('')

// Gemini API helper - using Google's recommended format
const callGeminiAPI = async (prompt, apiKey) => {
  console.log(`🔄 Iniciando chamada à API Gemini...`)
  
  // Use Google's exact recommended endpoint and model
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`
  
  console.log(`📡 Usando modelo: gemini-2.5-flash-lite`)
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    })
    
    console.log(`📊 Status: ${response.status}`)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      console.error(`❌ Erro da API:`, errorData)
      throw new Error(errorData?.error?.message || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    // Handle response
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      console.log(`✅ Sucesso!`)
      return data.candidates[0].content.parts[0].text
    } else if (data.error) {
      throw new Error(data.error.message)
    } else {
      console.warn(`⚠️ Resposta inesperada:`, data)
      throw new Error('Formato de resposta inesperado')
    }
  } catch (error) {
    console.error(`\n❌ ERRO NA CHAMADA DA API ❌`)
    console.error(`Erro:`, error.message)
    console.error(`\n🔍 SOLUÇÃO:`)
    console.error(`1. Verifique sua API key em: https://aistudio.google.com/`)
    console.error(`2. Certifique-se de ter aceitado os Termos de Serviço`)
    console.error(`3. Se o erro persistir, teste a API key manualmente no AI Studio`)
    
    throw error
  }
}

// Load saved progress on mount
onMounted(() => {
  // Check if there's saved progress
  const savedProgress = cacheManager.loadProgress('current_session')
  if (savedProgress && savedProgress.processedRows) {
    console.log('💾 Found saved progress:', savedProgress)
    // Could potentially restore state here
  }
  
  // Log cache stats
  const stats = cacheManager.getStats()
  console.log('💾 Cache stats:', stats)
})

const processData = async () => {
  isProcessing.value = true
  processStatus.value = null
  downloadUrl.value = ''
  progress.value = 0
  queueStats.value = { queued: 0, completed: 0, cached: 0, errors: 0, totalPlants: 0, plantsProcessed: 0 }
  
  try {
    console.log('🚀 Iniciando processamento...')
    
    progressText.value = 'Carregando dados...'
    progress.value = 20
    await new Promise(resolve => setTimeout(resolve, 300))
    
    progressText.value = 'Sanitizando dados...'
    progress.value = 40
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Emit process event to parent to get processed data
    emit('process')
    
    progressText.value = 'Aplicando transformações...'
    progress.value = 50
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Process AI columns if any
    const aiColumns = props.newColumns.filter(col => col.valueType === 'ai' && col.aiPrompt)
    let finalData = [...props.fullData]  // Use fullData for AI processing (has all columns)
    
    if (aiColumns.length > 0) {
      let apiKey = localStorage.getItem('gemini_api_key')
      
      // Fallback to default key from environment if user hasn't set their own
      if (!apiKey) {
        apiKey = import.meta.env.VITE_GEMINI_API_KEY
      }
      
      if (!apiKey) {
        throw new Error('Chave da API Gemini não configurada. Configure na Etapa 3.')
      }
      
      progressText.value = `Preparando processamento com IA (${aiColumns.length} colunas)...`
      progress.value = 55
      
      // Create mapping from displayName to originalName
      const displayToOriginalMap = {}
      if (props.columnState && props.columnState.length > 0) {
        props.columnState.forEach(col => {
          displayToOriginalMap[col.displayName] = col.originalName
        })
      }
      
      // Generate session ID for progress tracking
      sessionId.value = `session_${Date.now()}`
      
      // Initialize request queue with high rate limit (2000 req/min, 100ms delay)
      // Gemini API free tier: 4K req/min, 4M tokens/min
      requestQueue = new RequestQueue(2000, 100)
      
      // Set up queue callbacks
      requestQueue.onProgress = (progressData) => {
        queueStats.value.completed = progressData.completed
        queueStats.value.errors = progressData.errors
        
        const totalBatches = progressData.total
        const currentBatches = progressData.completed
        const percent = Math.floor((queueStats.value.plantsProcessed / queueStats.value.totalPlants) * 30) // 30% of progress bar for AI
        progress.value = 55 + percent
        
        progressText.value = `IA: ${queueStats.value.plantsProcessed}/${queueStats.value.totalPlants} plantas (${currentBatches}/${totalBatches} lotes, ${queueStats.value.cached} cache)`
        
        // Save progress periodically
        if (progressData.completed % 5 === 0) {
          cacheManager.saveProgress(sessionId.value, {
            completed: progressData.completed,
            total: progressData.total,
            cached: queueStats.value.cached,
            errors: progressData.errors,
            timestamp: Date.now()
          })
        }
      }
      
      requestQueue.onComplete = () => {
        console.log('✅ Queue processing completed')
        progressText.value = 'Processamento IA concluído!'
        
        // Clear progress after successful completion
        cacheManager.clearProgress(sessionId.value)
      }
      
      requestQueue.onError = (errorData) => {
        console.error(`❌ Request failed after ${errorData.retries} retries:`, errorData.id)
      }
      
      // Process each AI column
      for (const aiCol of aiColumns) {
        console.log(`🤖 Processando coluna IA: ${aiCol.name}`)
        console.log(`📝 Prompt template: ${aiCol.aiPrompt}`)
        
        let skippedCount = 0
        const batchSize = 25 // Process 25 rows per batch to optimize API usage and reduce total requests
        const rowsToProcess = []
        
        // First pass: collect rows that need processing
        for (let i = 0; i < finalData.length; i++) {
          const row = finalData[i]
          
          // Skip if cell already has content (handle non-string values safely)
          const cellValue = row[aiCol.name]
          const hasContent = cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== ''
          
          if (hasContent) {
            if (i < 5) console.log(`⊙ Linha ${i + 1} pulada (já tem conteúdo)`)
            skippedCount++
            continue
          }
          
          // Extract column values for prompt (allows optional/blank columns)
          const matches = aiCol.aiPrompt.match(/\{([^}]+)\}/g)
          const columnValues = {}
          const referencedColumns = new Set() // Track which columns are actually used in prompt
          
          if (matches) {
            for (const match of matches) {
              const colName = match.slice(1, -1).trim()
              referencedColumns.add(colName)
              
              // Try to find value with various strategies
              let value = ''
              
              // Strategy 1: Direct match
              if (row[colName] !== undefined && row[colName] !== null && row[colName] !== '') {
                value = row[colName]
              } 
              // Strategy 2: Display to original mapping
              else if (displayToOriginalMap[colName] && row[displayToOriginalMap[colName]] !== undefined && row[displayToOriginalMap[colName]] !== null && row[displayToOriginalMap[colName]] !== '') {
                value = row[displayToOriginalMap[colName]]
              }
              // Strategy 3: Case-insensitive search
              else {
                const normalizedColName = colName.toLowerCase().trim()
                for (const [key, val] of Object.entries(row)) {
                  const normalizedKey = key.toLowerCase().trim()
                  if (normalizedKey === normalizedColName && val !== undefined && val !== null && val !== '') {
                    value = val
                    break
                  }
                }
              }
              
              // Convert to string safely (handle objects, arrays, etc.)
              if (typeof value === 'object' && value !== null) {
                console.warn(`⚠️ Coluna "${colName}" contém objeto, convertendo para JSON:`, value)
                value = JSON.stringify(value)
              } else {
                value = String(value)
              }
              
              columnValues[colName] = value
            }
          }
          
          // Build individual prompt (blank columns are replaced with empty string)
          let prompt = aiCol.aiPrompt
          if (matches) {
            matches.forEach(match => {
              const colName = match.slice(1, -1).trim()
              const value = String(columnValues[colName] || '')
              prompt = prompt.replace(match, value)
            })
          }
          
          // Clean up multiple consecutive spaces (from blank columns)
          prompt = prompt.replace(/\s{2,}/g, ' ').trim()
          
          // Skip if prompt has no actual data (all columns were empty)
          // Check if all referenced values are empty
          const hasAnyData = Object.values(columnValues).some(val => val !== '' && val !== null && val !== undefined)
          if (!hasAnyData) {
            if (i < 5) console.log(`⊘ Linha ${i + 1} pulada (todas as colunas vazias)`)
            finalData[i][aiCol.name] = ''
            skippedCount++
            continue
          }
          
          // Debug: Log prompts for first few rows
          if (i < 3) console.log(`📝 Linha ${i + 1} prompt: "${prompt}"`)
          
          // Check cache first
          const cacheKey = cacheManager.generateCacheKey(prompt, row)
          const cachedResponse = cacheManager.get(cacheKey)
          
          if (cachedResponse) {
            finalData[i][aiCol.name] = cachedResponse
            queueStats.value.cached++
            if (i < 5) console.log(`💾 Linha ${i + 1} usando cache`)
            continue
          }
          
          // Add to batch
          rowsToProcess.push({
            rowIndex: i,
            prompt,
            columnValues, // Only contains columns referenced in prompt
            cacheKey,
            promptNormalized: prompt.toLowerCase().trim() // For grouping identical prompts
          })
        }
        
        // Sort rows by normalized prompt to group identical species together
        // This ensures consistent AI responses for the same species
        rowsToProcess.sort((a, b) => a.promptNormalized.localeCompare(b.promptNormalized))
        
        // Build a map of unique prompts to avoid duplicate API calls
        const promptToRows = new Map()
        rowsToProcess.forEach(item => {
          if (!promptToRows.has(item.promptNormalized)) {
            promptToRows.set(item.promptNormalized, [])
          }
          promptToRows.get(item.promptNormalized).push(item)
        })
        
        console.log(`📊 ${rowsToProcess.length} linhas para processar, ${promptToRows.size} prompts únicos`)
        
        // Create deduplicated list (one representative per unique prompt)
        const uniqueRowsToProcess = Array.from(promptToRows.values()).map(rows => rows[0])
        
        // Process in batches (using unique prompts only)
        for (let batchStart = 0; batchStart < uniqueRowsToProcess.length; batchStart += batchSize) {
          const batch = uniqueRowsToProcess.slice(batchStart, batchStart + batchSize)
          const batchEnd = Math.min(batchStart + batchSize, uniqueRowsToProcess.length)
          
          console.log(`📦 Criando lote ${Math.floor(batchStart / batchSize) + 1}: ${batch.length} prompts únicos (${batch.map(b => promptToRows.get(b.promptNormalized).length).reduce((a, c) => a + c, 0)} linhas totais)`)
          
          // Create batched prompt
          let batchedPrompt = ''
          
          if (batch.length === 1) {
            // Single item, use original prompt
            batchedPrompt = batch[0].prompt
          } else {
            // Multiple items, create structured batch prompt
            const basePromptText = aiCol.aiPrompt.replace(/\{[^}]+\}/g, '').trim()
            
            batchedPrompt = `Responda no formato JSON array. Para cada planta abaixo, crie a descrição solicitada. Retorne APENAS um array JSON sem texto adicional.\n\n`
            batchedPrompt += `Instruções: ${basePromptText}\n\n`
            batchedPrompt += `Plantas:\n`
            
            batch.forEach((item, idx) => {
              const plantInfo = Object.entries(item.columnValues)
                // Filter out blank values
                .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
                .map(([key, value]) => {
                  // Ensure value is a string
                  const stringValue = typeof value === 'object' && value !== null 
                    ? JSON.stringify(value) 
                    : String(value)
                  return `${key}: ${stringValue}`
                })
                .join(', ')
              batchedPrompt += `${idx + 1}. ${plantInfo}\n`
            })
            
            batchedPrompt += `\nRetorne array JSON: ["descrição planta 1", "descrição planta 2", ...]`
          }
          
          // Add batch to queue
          const batchId = `batch_${aiCol.name}_${batchStart}_${batchEnd}`
          requestQueue.addRequest(
            batchId,
            async () => {
              console.log(`🚀 Processando lote com ${batch.length} itens...`)
              const result = await callGeminiAPI(batchedPrompt, apiKey)
              
              let responses = []
              if (batch.length === 1) {
                responses = [result.trim()]
              } else {
                // Parse JSON response
                try {
                  // Try to extract JSON array from response
                  const jsonMatch = result.match(/\[[\s\S]*\]/)
                  if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0])
                    // Ensure all items are strings
                    responses = parsed.map(item => {
                      if (typeof item === 'object' && item !== null) {
                        console.warn('⚠️ Resposta contém objeto, convertendo:', item)
                        return JSON.stringify(item)
                      }
                      return String(item || '')
                    })
                  } else {
                    console.warn('⚠️ Nenhum JSON array encontrado na resposta')
                    // Fallback: split by lines or numbers
                    const lines = result.split(/\n\d+\.|PLANTA \d+:/).filter(l => l.trim())
                    responses = lines.map(l => l.trim().replace(/^["']|["']$/g, ''))
                  }
                  
                  // Ensure we have enough responses
                  if (responses.length < batch.length) {
                    console.warn(`⚠️ Resposta incompleta: esperado ${batch.length}, recebido ${responses.length}`)
                    console.warn('⚠️ Resposta original:', result.substring(0, 500))
                    // Pad with placeholders
                    while (responses.length < batch.length) {
                      responses.push('[Resposta incompleta - tente processar novamente]')
                    }
                  }
                } catch (parseError) {
                  console.error('❌ Erro ao parsear resposta JSON:', parseError)
                  console.error('❌ Resposta original:', result.substring(0, 500))
                  // Fallback: use full response for first item, placeholders for rest
                  responses = [result.trim()]
                  while (responses.length < batch.length) {
                    responses.push('[Erro ao processar - tente novamente]')
                  }
                }
              }
              
              // Store results and cache (apply to ALL rows with same prompt)
              batch.forEach((item, idx) => {
                const response = responses[idx] || '[Erro ao processar]'
                
                // Get ALL rows with this same prompt
                const duplicateRows = promptToRows.get(item.promptNormalized)
                
                // Apply the same response to all duplicate rows
                duplicateRows.forEach(duplicateItem => {
                  finalData[duplicateItem.rowIndex][aiCol.name] = response
                  
                  // Cache individual response
                  cacheManager.set(duplicateItem.cacheKey, response, {
                    rowIndex: duplicateItem.rowIndex,
                    columnName: aiCol.name,
                    batchId
                  })
                  
                  // Update plants processed count
                  queueStats.value.plantsProcessed++
                })
                
                if (duplicateRows.length > 1) {
                  console.log(`✓ Resposta aplicada a ${duplicateRows.length} linhas idênticas`)
                }
              })
              
              const totalRowsProcessed = batch.reduce((sum, item) => sum + promptToRows.get(item.promptNormalized).length, 0)
              return `Batch processed: ${batch.length} unique prompts, ${totalRowsProcessed} total rows`
            },
            0
          )
          
          queueStats.value.queued++
        }
        
        queueStats.value.totalPlants = finalData.length
        queueStats.value.plantsProcessed = queueStats.value.cached
        
        console.log(`📊 Coluna "${aiCol.name}": ${skippedCount} puladas, ${queueStats.value.cached} em cache, ${rowsToProcess.length} linhas (${uniqueRowsToProcess.length} únicas) para processar em ${Math.ceil(uniqueRowsToProcess.length / batchSize)} lotes`)
      }
      
      // Start queue processing
      if (requestQueue.queue.length > 0) {
        console.log(`🚀 Iniciando fila com ${requestQueue.queue.length} requisições`)
        progressText.value = `Processando ${requestQueue.queue.length} requisições (máx 2000/min)...`
        await requestQueue.start()
      } else {
        console.log('✓ Nenhuma requisição necessária (todas em cache ou puladas)')
      }
      
      progress.value = 85
    }
    
    // Now filter to selected columns only for final export
    if (props.selectedColumns && props.selectedColumns.length > 0) {
      finalData = finalData.map(row => {
        const filtered = {}
        
        // Add selected columns with their renamed displayNames
        props.selectedColumns.forEach(col => {
          // Access data using originalName, but store with displayName
          filtered[col.displayName] = row[col.originalName]
        })
        
        // Add new columns (custom columns should be kept)
        if (props.newColumns && props.newColumns.length > 0) {
          props.newColumns.forEach(col => {
            if (col.name && row[col.name] !== undefined) {
              filtered[col.name] = row[col.name]
            }
          })
        }
        
        return filtered
      })
    }
    
    progressText.value = 'Gerando arquivo CSV...'
    progress.value = 80
    
    console.log('📊 Dados para processar:', finalData)
    
    if (!finalData || finalData.length === 0) {
      throw new Error('Nenhum dado disponível para processar')
    }
    
    // Generate CSV using PapaCSV
    const csv = Papa.unparse(finalData, {
      header: true,
      skipEmptyLines: true
    })
    
    console.log('✅ CSV gerado, tamanho:', csv.length, 'caracteres')
    
    // Add UTF-8 BOM (Byte Order Mark) so Excel recognizes UTF-8 encoding
    // This prevents encoding issues with accented characters
    const BOM = '\uFEFF'
    const csvWithBOM = BOM + csv
    
    // Create blob and download URL
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    downloadUrl.value = url
    downloadFileName.value = props.fileName
    
    progress.value = 100
    progressText.value = 'Concluído!'
    
    processStatus.value = {
      type: 'success',
      message: '✅ Dados processados com sucesso! Clique no botão abaixo para baixar.'
    }
    
    console.log('🎉 Processamento concluído!')
    
  } catch (error) {
    console.error('❌ Erro no processamento:', error)
    processStatus.value = {
      type: 'error',
      message: '❌ Erro ao processar dados: ' + error.message
    }
  } finally {
    isProcessing.value = false
  }
}

// Expose method to set download URL (called by parent after processing)
const setDownloadUrl = (url, fileName) => {
  downloadUrl.value = url
  downloadFileName.value = fileName
}

defineExpose({ setDownloadUrl })
</script>

<style scoped>
.step-container {
  padding: 2rem;
  max-width: 900px;
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

.summary-section {
  margin-bottom: 2rem;
}

.summary-card {
  background-color: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e0e0e0;
}

.summary-item:last-child {
  border-bottom: none;
}

.summary-item strong {
  color: #2c3e50;
}

.summary-item span {
  color: #666;
}

.process-section {
  text-align: center;
  margin: 2rem 0;
}

.process-btn {
  background: linear-gradient(135deg, #4360e3 0%, #000231 100%);
  color: white;
  padding: 1rem 3rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.2rem;
  font-weight: 600;
  transition: transform 0.3s, box-shadow 0.3s;
  box-shadow: 0 4px 15px rgba(67, 96, 227, 0.3);
}

.process-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(67, 96, 227, 0.4);
}

.process-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-section {
  margin-top: 2rem;
}

.status-message {
  padding: 1rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  font-weight: 500;
}

.status-message.success {
  background-color: #d4edda;
  border-left: 4px solid #28a745;
  color: #155724;
}

.status-message.error {
  background-color: #ffe7e7;
  border-left: 4px solid #dc3545;
  color: #dc3545;
}

.download-section {
  text-align: center;
}

.download-link {
  display: inline-block;
  background-color: #28a745;
  color: white;
  padding: 0.75rem 2rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  transition: background-color 0.3s;
}

.download-link:hover {
  background-color: #218838;
}

.progress-section {
  margin-top: 2rem;
}

.progress-bar {
  width: 100%;
  height: 30px;
  background-color: #e0e0e0;
  border-radius: 15px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4360e3 0%, #28a745 100%);
  transition: width 0.3s ease;
  border-radius: 15px;
}

.progress-text {
  text-align: center;
  color: #666;
  font-weight: 500;
}

.queue-stats {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.9rem;
  color: #666;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #28a745;
}

.stat-value.error {
  color: #dc3545;
}
</style>
