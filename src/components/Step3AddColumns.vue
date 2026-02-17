<template>
  <div class="step-container">
    <h2>Etapa 3: Adicionar Colunas</h2>
    <p class="step-description">Adicione novas colunas ao seu CSV</p>
    
    <div class="add-column-section">
      <button type="button" class="add-btn" @click="addNewColumn">
        + Adicionar Nova Coluna
      </button>
    </div>

    <div v-if="newColumns.length === 0" class="empty-state">
      <p>Nenhuma coluna adicionada ainda. Clique no botão acima para adicionar.</p>
    </div>

    <div v-else class="columns-list">
      <div v-for="(col, index) in newColumns" :key="col.id" class="column-card">
        <div class="column-header">
          <h3>Coluna {{ index + 1 }}</h3>
          <button type="button" class="remove-btn" @click="removeColumn(index)">✕</button>
        </div>
        
        <div class="column-form">
          <div class="form-group">
            <label>Nome da Coluna</label>
            <input 
              v-model="col.name" 
              type="text" 
              placeholder="Ex: Status, Categoria..."
              class="form-input"
              @input="checkDuplicateName(col)"
            />
            <p v-if="col.duplicateWarning" class="warning-message">
              ⚠️ Já existe uma coluna com este nome. Ela será substituída.
            </p>
          </div>

          <div class="form-group">
            <label>Tipo de Valor</label>
            <select v-model="col.valueType" class="form-select">
              <option value="fixed">Valor Fixo</option>
              <option value="formula">Fórmula/Concatenação</option>
              <option value="sequence">Sequência Numérica</option>
              <option value="date">Data Atual</option>
              <option value="ai">IA (Gemini API)</option>
            </select>
          </div>

          <!-- Fixed Value -->
          <div v-if="col.valueType === 'fixed'" class="form-group">
            <label>Valor</label>
            <input 
              v-model="col.value" 
              type="text" 
              placeholder="Digite o valor fixo"
              class="form-input"
            />
          </div>

          <!-- Formula -->
          <div v-if="col.valueType === 'formula'" class="form-group">
            <label>Fórmula</label>
            <input 
              v-model="col.formula" 
              type="text" 
              placeholder="Ex: {coluna1} - {coluna2} ou {padLeft(codigo, 3)}"
              class="form-input"
              @input="updatePreview(col)"
            />
            <p class="hint">Use {nomeColuna} para referenciar colunas. Funções disponíveis: {padLeft(valor, tamanho)}</p>
            
            <!-- Formula Preview -->
            <div v-if="col.formula && sampleRow" class="formula-preview">
              <strong>Pré-visualização (linha 1):</strong>
              <code>{{ getFormulaPreview(col.formula) }}</code>
            </div>
          </div>

          <!-- Sequence -->
          <div v-if="col.valueType === 'sequence'" class="form-group">
            <label>Início da Sequência</label>
            <input 
              v-model.number="col.sequenceStart" 
              type="number" 
              class="form-input"
            />
          </div>

          <div v-if="col.valueType === 'sequence'" class="form-group">
            <label>Formato com Zeros à Esquerda</label>
            <input 
              v-model.number="col.sequencePadding" 
              type="number" 
              placeholder="Ex: 3 para 001, 002, 003..."
              class="form-input"
              min="0"
            />
            <p class="hint">Deixe 0 ou vazio para não aplicar padding</p>
          </div>

          <!-- Date Format -->
          <div v-if="col.valueType === 'date'" class="form-group">
            <label>Formato da Data</label>
            <select v-model="col.dateFormat" class="form-select">
              <option value="yyyy-mm-dd">AAAA-MM-DD</option>
              <option value="dd/mm/yyyy">DD/MM/AAAA</option>
              <option value="mm/dd/yyyy">MM/DD/AAAA</option>
              <option value="iso">ISO 8601</option>
            </select>
          </div>

          <!-- AI Prompt -->
          <div v-if="col.valueType === 'ai'" class="ai-section">
            <div class="form-group">
              <label>Prompt para IA</label>
              <textarea 
                v-model="col.aiPrompt" 
                placeholder="Ex: Create a basic description of the plant {genus} {species}, including country origin, climate and type of plant. Aim for around 50 words."
                class="form-textarea"
                rows="4"
              ></textarea>
              <p class="hint">Use {nomeColuna} para referenciar outras colunas. Células não vazias serão puladas.</p>
            </div>
            
            <div v-if="!geminiApiKey" class="api-key-section">
              <div class="form-group">
                <label>Chave da API Gemini</label>
                <div class="api-key-input-group">
                  <input 
                    v-model="tempApiKey" 
                    :type="showApiKey ? 'text' : 'password'"
                    placeholder="Digite sua chave da API Gemini"
                    class="form-input api-key-input"
                  />
                  <button type="button" @click="showApiKey = !showApiKey" class="toggle-visibility-btn" title="Mostrar/Ocultar chave">
                    {{ showApiKey ? '🙈' : '👁️' }}
                  </button>
                </div>
                <p class="hint">Sua chave será armazenada localmente no navegador. <a href="https://aistudio.google.com/app/apikey" target="_blank">Obter chave</a></p>
                <button type="button" @click="saveApiKey" class="save-api-key-btn" :disabled="!tempApiKey.trim()">Salvar Chave</button>
              </div>
            </div>
            
            <div v-else class="api-key-saved">
              <div>
                <p v-if="currentApiKeySource === 'default'">✓ Usando chave padrão do sistema</p>
                <p v-else-if="currentApiKeySource === 'user'">✓ Chave da API configurada (sua chave)</p>
                <p v-else>✓ Chave da API configurada</p>
                <p class="hint" style="margin-top: 0.5rem;">
                  Chave atual: {{ geminiApiKey.substring(0, 15) }}...{{ geminiApiKey.substring(geminiApiKey.length - 4) }}
                </p>
              </div>
              <div class="api-key-actions">
                <button v-if="!showKeyInput" type="button" @click="showKeyInput = true" class="change-api-key-btn">Alterar Chave</button>
                <button v-if="hasUserKey" type="button" @click="clearApiKey" class="clear-api-key-btn">Remover Chave</button>
              </div>
            </div>
            
            <div v-if="geminiApiKey && showKeyInput" class="api-key-section" style="margin-top: 1rem;">
              <div class="form-group">
                <label>Nova Chave da API Gemini</label>
                <div class="api-key-input-group">
                  <input 
                    v-model="tempApiKey" 
                    :type="showApiKey ? 'text' : 'password'"
                    placeholder="Digite a nova chave da API Gemini"
                    class="form-input api-key-input"
                  />
                  <button type="button" @click="showApiKey = !showApiKey" class="toggle-visibility-btn" title="Mostrar/Ocultar chave">
                    {{ showApiKey ? '🙈' : '👁️' }}
                  </button>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                  <button type="button" @click="saveApiKey" class="save-api-key-btn" :disabled="!tempApiKey.trim()">Salvar Nova Chave</button>
                  <button type="button" @click="showKeyInput = false; tempApiKey = ''; showApiKey = false" class="cancel-btn">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  sampleRow: {
    type: Object,
    default: () => ({})
  },
  columnState: {
    type: Array,
    default: () => []
  },
  savedNewColumns: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:columns', 'next', 'prev'])

let columnIdCounter = 0

// Initialize from saved state if available, otherwise start empty
const newColumns = ref(
  props.savedNewColumns && props.savedNewColumns.length > 0
    ? [...props.savedNewColumns]
    : []
)

// Update columnIdCounter to avoid ID collisions
if (newColumns.value.length > 0) {
  const maxId = Math.max(...newColumns.value.map(col => col.id || 0))
  columnIdCounter = maxId + 1
}

const geminiApiKey = ref('')
const tempApiKey = ref('')
const showApiKey = ref(false)
const showKeyInput = ref(false)
const hasDefaultKey = ref(false)
const hasUserKey = ref(false)
const currentApiKeySource = ref('') // 'default', 'user', or ''

// Load API key from localStorage on mount
onMounted(() => {
  const savedKey = localStorage.getItem('gemini_api_key')
  if (savedKey) {
    geminiApiKey.value = savedKey
    hasUserKey.value = true
    currentApiKeySource.value = 'user'
  }
  
  // Check if default key is available from environment
  const defaultKey = import.meta.env.VITE_GEMINI_API_KEY
  console.log('🔑 Verificando chave padrão do ambiente:', defaultKey ? 'Encontrada' : 'Não encontrada')
  if (defaultKey && defaultKey.trim()) {
    hasDefaultKey.value = true
    // Use default key if user hasn't set their own
    if (!geminiApiKey.value) {
      geminiApiKey.value = defaultKey
      currentApiKeySource.value = 'default'
      console.log('🔑 Usando chave padrão do ambiente')
    } else {
      console.log('🔑 Usando chave do localStorage')
    }
  }
  
  console.log('🔑 Chave da API carregada:', geminiApiKey.value ? '✓' : '✗')
  console.log('🔑 Fonte:', currentApiKeySource.value)
  console.log('🔑 Primeiros 10 caracteres:', geminiApiKey.value ? geminiApiKey.value.substring(0, 10) + '...' : 'N/A')
})

const saveApiKey = () => {
  if (tempApiKey.value.trim()) {
    localStorage.setItem('gemini_api_key', tempApiKey.value.trim())
    geminiApiKey.value = tempApiKey.value.trim()
    hasUserKey.value = true
    currentApiKeySource.value = 'user'
    tempApiKey.value = ''
    showApiKey.value = false
    showKeyInput.value = false
    console.log('✅ Chave da API salva com sucesso')
    console.log('🔑 Primeiros 10 caracteres:', geminiApiKey.value.substring(0, 10) + '...')
  }
}

const clearApiKey = () => {
  localStorage.removeItem('gemini_api_key')
  tempApiKey.value = ''
  hasUserKey.value = false
  showKeyInput.value = false
  
  // Restore default key if available
  const defaultKey = import.meta.env.VITE_GEMINI_API_KEY
  if (defaultKey && defaultKey.trim()) {
    geminiApiKey.value = defaultKey
    currentApiKeySource.value = 'default'
    console.log('🔑 Chave do usuário removida, voltando para chave padrão')
  } else {
    geminiApiKey.value = ''
    currentApiKeySource.value = ''
    console.log('🔑 Chave removida completamente')
  }
}

const addNewColumn = () => {
  newColumns.value.push({
    id: columnIdCounter++,
    name: '',
    valueType: 'fixed',
    value: '',
    formula: '',
    sequenceStart: 1,
    sequencePadding: 0,
    dateFormat: 'yyyy-mm-dd',
    aiPrompt: '',
    duplicateWarning: false
  })
  emitUpdate()
}

const removeColumn = (index) => {
  newColumns.value.splice(index, 1)
  emitUpdate()
}

const getFormulaPreview = (formula) => {
  if (!formula || !props.sampleRow) return ''
  
  // Create mapping from displayName to originalName
  const displayToOriginalMap = {}
  if (props.columnState && props.columnState.length > 0) {
    props.columnState.forEach(col => {
      displayToOriginalMap[col.displayName] = col.originalName
    })
  }
  
  let preview = formula
  
  // Handle padLeft function: {padLeft(columnName, length)}
  const padLeftRegex = /\{padLeft\(([^,]+),\s*(\d+)\)\}/g
  preview = preview.replace(padLeftRegex, (match, colName, length) => {
    const trimmedColName = colName.trim()
    let value = '[não encontrado]'
    
    // Try to find value using same strategy as regular columns
    if (props.sampleRow[trimmedColName] !== undefined) {
      value = props.sampleRow[trimmedColName]
    } else if (displayToOriginalMap[trimmedColName] && props.sampleRow[displayToOriginalMap[trimmedColName]] !== undefined) {
      value = props.sampleRow[displayToOriginalMap[trimmedColName]]
    }
    
    // Convert to string and pad
    return String(value || '').padStart(parseInt(length), '0')
  })
  
  // Handle regular {columnName} patterns
  const matches = preview.match(/\{([^}]+)\}/g)
  
  if (matches) {
    matches.forEach(match => {
      const colName = match.slice(1, -1).trim()
      
      // Try to find value: first try direct match, then try display->original mapping
      let value = '[não encontrado]'
      if (props.sampleRow[colName] !== undefined) {
        value = props.sampleRow[colName]
      } else if (displayToOriginalMap[colName] && props.sampleRow[displayToOriginalMap[colName]] !== undefined) {
        value = props.sampleRow[displayToOriginalMap[colName]]
      }
      
      preview = preview.replace(match, value)
    })
  }
  
  return preview
}

const updatePreview = (col) => {
  // Trigger reactivity for preview
  emitUpdate()
}

const checkDuplicateName = (col) => {
  if (!col.name) {
    col.duplicateWarning = false
    return
  }
  
  // Check if name conflicts with existing columns from CSV
  const existingColumns = props.columnState.map(c => c.displayName.toLowerCase())
  const isDuplicate = existingColumns.includes(col.name.toLowerCase())
  
  col.duplicateWarning = isDuplicate
}

const emitUpdate = () => {
  emit('update:columns', newColumns.value)
}

watch(newColumns, emitUpdate, { deep: true })
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

.step-description {
  color: #666;
  margin-bottom: 2rem;
}

.add-column-section {
  margin-bottom: 2rem;
}

.add-btn {
  background-color: #28a745;
  color: white;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s;
}

.add-btn:hover {
  background-color: #218838;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #666;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 2px dashed #ddd;
}

.columns-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.column-card {
  background-color: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.column-header h3 {
  font-size: 1.2rem;
  color: #2c3e50;
  margin: 0;
}

.remove-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.2rem;
  transition: background-color 0.3s;
}

.remove-btn:hover {
  background-color: #c82333;
}

.column-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: #2c3e50;
}

.form-input,
.form-select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 1rem;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #4360e3;
}

.hint {
  font-size: 0.85rem;
  color: #666;
  margin: 0;
}

.hint a {
  color: #4360e3;
  text-decoration: none;
}

.hint a:hover {
  text-decoration: underline;
}

.warning-message {
  font-size: 0.85rem;
  color: #d97706;
  margin: 0.25rem 0 0 0;
  font-weight: 500;
}

.form-textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  resize: vertical;
  font-family: inherit;
}

.form-textarea:focus {
  outline: none;
  border-color: #4360e3;
}

.ai-section {
  background: #f8f9ff;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #e0e5ff;
}

.api-key-section {
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 6px;
  border: 1px solid #ddd;
}

.api-key-input-group {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
}

.api-key-input {
  flex: 1;
}

.toggle-visibility-btn {
  padding: 0.5rem 1rem;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.2rem;
  transition: background-color 0.2s;
  flex-shrink: 0;
}

.toggle-visibility-btn:hover {
  background: #e0e0e0;
}

.save-api-key-btn {
  padding: 0.5rem 1rem;
  background: #4360e3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.2s;
}

.save-api-key-btn:hover:not(:disabled) {
  background: #3550d3;
}

.save-api-key-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: #f0f0f0;
  border-color: #999;
}

.api-key-saved {
  margin-top: 1rem;
  padding: 1rem;
  background: #e7f9f0;
  border-radius: 6px;
  border: 1px solid #b3e5d0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.api-key-saved > div:first-child {
  flex: 1;
}

.api-key-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.api-key-saved p {
  margin: 0;
  color: #0a8754;
  font-weight: 600;
}

.change-api-key-btn {
  padding: 0.4rem 0.8rem;
  background: #4360e3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
  transition: background-color 0.2s;
}

.change-api-key-btn:hover {
  background: #3550d3;
}

.hint-text {
  font-size: 0.85rem;
  color: #666;
  font-weight: normal;
}

.clear-api-key-btn {
  padding: 0.4rem 0.8rem;
  background: transparent;
  color: #c62828;
  border: 1px solid #c62828;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.clear-api-key-btn:hover {
  background: #c62828;
  color: white;
}

.formula-preview {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: #e7f3ff;
  border-left: 4px solid #4360e3;
  border-radius: 4px;
}

.formula-preview strong {
  display: block;
  margin-bottom: 0.5rem;
  color: #2c3e50;
  font-size: 0.9rem;
}

.formula-preview code {
  display: block;
  background-color: white;
  padding: 0.5rem;
  border-radius: 4px;
  color: #000231;
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  word-break: break-word;
}
</style>
