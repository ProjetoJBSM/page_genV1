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
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Papa from 'papaparse'

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
  processedData: {
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

// Gemini API helper
const callGeminiAPI = async (prompt, apiKey) => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
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
  
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
  }
  
  const data = await response.json()
  return data.candidates[0].content.parts[0].text
}

const processData = async () => {
  isProcessing.value = true
  processStatus.value = null
  downloadUrl.value = ''
  progress.value = 0
  
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
    progress.value = 60
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // Process AI columns if any
    const aiColumns = props.newColumns.filter(col => col.valueType === 'ai' && col.aiPrompt)
    let finalData = [...props.processedData]
    
    if (aiColumns.length > 0) {
      let apiKey = localStorage.getItem('gemini_api_key')
      
      // Fallback to default key from environment if user hasn't set their own
      if (!apiKey) {
        apiKey = import.meta.env.VITE_GEMINI_API_KEY
      }
      
      if (!apiKey) {
        throw new Error('Chave da API Gemini não configurada. Configure na Etapa 3.')
      }
      
      progressText.value = `Processando com IA (${aiColumns.length} colunas)...`
      
      // Create mapping from displayName to originalName
      const displayToOriginalMap = {}
      if (props.columnState && props.columnState.length > 0) {
        props.columnState.forEach(col => {
          displayToOriginalMap[col.displayName] = col.originalName
        })
      }
      
      // Process each AI column
      for (const aiCol of aiColumns) {
        console.log(`🤖 Processando coluna IA: ${aiCol.name}`)
        
        // Process each row
        for (let i = 0; i < finalData.length; i++) {
          const row = finalData[i]
          
          // Skip if cell already has content (for updating existing spreadsheets)
          if (row[aiCol.name] && row[aiCol.name].trim() !== '') {
            continue
          }
          
          // Check if any referenced columns have missing data
          let hasAllData = true
          const matches = aiCol.aiPrompt.match(/\{([^}]+)\}/g)
          
          if (matches) {
            for (const match of matches) {
              const colName = match.slice(1, -1).trim()
              
              // Try to find value: direct match or display->original mapping
              let value = ''
              if (row[colName] !== undefined && row[colName] !== null) {
                value = row[colName]
              } else if (displayToOriginalMap[colName] && row[displayToOriginalMap[colName]] !== undefined && row[displayToOriginalMap[colName]] !== null) {
                value = row[displayToOriginalMap[colName]]
              }
              
              // Skip row if value is empty/null/undefined
              if (value === '' || value === null || value === undefined) {
                hasAllData = false
                break
              }
            }
          }
          
          // Skip this row if any referenced column has missing data
          if (!hasAllData) {
            console.log(`⊘ Linha ${i + 1} pulada (dados faltando)`)
            finalData[i][aiCol.name] = ''
            continue
          }
          
          // Replace placeholders in prompt with actual values
          let prompt = aiCol.aiPrompt
          
          if (matches) {
            matches.forEach(match => {
              const colName = match.slice(1, -1).trim()
              
              // Try to find value: direct match or display->original mapping
              let value = ''
              if (row[colName] !== undefined) {
                value = row[colName]
              } else if (displayToOriginalMap[colName] && row[displayToOriginalMap[colName]] !== undefined) {
                value = row[displayToOriginalMap[colName]]
              }
              
              prompt = prompt.replace(match, value)
            })
          }
          
          // Update progress
          const rowProgress = ((i + 1) / finalData.length) * 20 // 20% of progress bar for AI
          progress.value = 60 + rowProgress
          progressText.value = `IA processando linha ${i + 1}/${finalData.length} da coluna "${aiCol.name}"...`
          
          try {
            const result = await callGeminiAPI(prompt, apiKey)
            finalData[i][aiCol.name] = result.trim()
            console.log(`✓ Linha ${i + 1} processada`)
          } catch (error) {
            console.error(`✗ Erro na linha ${i + 1}:`, error)
            finalData[i][aiCol.name] = `[Erro: ${error.message}]`
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
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
    
    // Create blob and download URL
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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
</style>
