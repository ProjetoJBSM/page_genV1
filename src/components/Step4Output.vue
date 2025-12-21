<template>
  <div class="step-container">
    <h2>Etapa 4: Configuração de Saída</h2>
    <p class="step-description">Escolha como deseja exportar os dados processados</p>
    
    <div class="output-options">
      <!-- Download CSV Option -->
      <div class="output-card">
        <label class="output-label">
          <input type="radio" v-model="outputType" value="download" />
          <div class="output-info">
            <h3>📥 Download CSV</h3>
            <p>Baixar o arquivo CSV processado para o seu computador</p>
          </div>
        </label>
        
        <div v-if="outputType === 'download'" class="output-config">
          <div class="form-group">
            <label>Nome do Arquivo</label>
            <input 
              v-model="downloadConfig.fileName" 
              type="text" 
              placeholder="dados_processados.csv"
              class="form-input"
            />
          </div>
          
          <div class="form-group">
            <label>Separador</label>
            <select v-model="downloadConfig.delimiter" class="form-select">
              <option value=",">Vírgula (,)</option>
              <option value=";">Ponto e vírgula (;)</option>
              <option value="\t">Tab</option>
            </select>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="downloadConfig.includeHeaders" />
              <span>Incluir cabeçalhos</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Google Sheets Option -->
      <div class="output-card">
        <label class="output-label">
          <input type="radio" v-model="outputType" value="sheets" />
          <div class="output-info">
            <h3>📊 Google Sheets</h3>
            <p>Escrever diretamente em uma planilha do Google Sheets</p>
          </div>
        </label>
        
        <div v-if="outputType === 'sheets'" class="output-config">
          <div class="form-group">
            <label>URL do Google Sheets</label>
            <input 
              v-model="sheetsConfig.spreadsheetUrl" 
              type="text" 
              placeholder="https://docs.google.com/spreadsheets/d/..."
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Nome da Planilha (aba)</label>
            <input 
              v-model="sheetsConfig.sheetName" 
              type="text" 
              placeholder="Planilha1"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>Chave da API do Google Sheets</label>
            <input 
              v-model="sheetsConfig.apiKey" 
              type="password" 
              placeholder="Sua API Key"
              class="form-input"
            />
            <p class="hint">
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank">
                Obter API Key
              </a>
            </p>
          </div>

          <div class="form-group">
            <label>Modo de Escrita</label>
            <select v-model="sheetsConfig.writeMode" class="form-select">
              <option value="append">Adicionar ao final</option>
              <option value="overwrite">Substituir tudo</option>
              <option value="insert">Inserir no início</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <div v-if="validationError" class="error-message">
      {{ validationError }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const emit = defineEmits(['update:config', 'next', 'prev'])

const outputType = ref('download')

const downloadConfig = ref({
  fileName: 'dados_processados.csv',
  delimiter: ',',
  includeHeaders: true
})

const sheetsConfig = ref({
  spreadsheetUrl: '',
  sheetName: 'Planilha1',
  apiKey: '',
  writeMode: 'append'
})

const validationError = computed(() => {
  if (outputType.value === 'download') {
    if (!downloadConfig.value.fileName) {
      return 'Por favor, forneça um nome para o arquivo'
    }
  } else if (outputType.value === 'sheets') {
    if (!sheetsConfig.value.spreadsheetUrl) {
      return 'Por favor, forneça a URL do Google Sheets'
    }
    if (!sheetsConfig.value.apiKey) {
      return 'Por favor, forneça a API Key'
    }
  }
  return null
})

const emitUpdate = () => {
  emit('update:config', {
    outputType: outputType.value,
    downloadConfig: downloadConfig.value,
    sheetsConfig: sheetsConfig.value,
    isValid: !validationError.value
  })
}

watch([outputType, downloadConfig, sheetsConfig], emitUpdate, { deep: true })
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
  margin: 0 0 0.5rem 0;
}

.step-description {
  color: #666;
  margin-bottom: 2rem;
}

.output-options {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.output-card {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
  transition: all 0.3s ease;
}

.output-card:has(input[type="radio"]:checked) {
  border-color: #4360e3;
  background-color: #f8f9ff;
}

.output-label {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  cursor: pointer;
}

.output-label input[type="radio"] {
  width: 24px;
  height: 24px;
  cursor: pointer;
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.output-info {
  flex: 1;
}

.output-info p {
  color: #666;
  margin: 0;
}

.output-config {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e0e0e0;
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

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal !important;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
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

.error-message {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #ffe7e7;
  border-left: 4px solid #dc3545;
  border-radius: 4px;
  color: #dc3545;
}
</style>
