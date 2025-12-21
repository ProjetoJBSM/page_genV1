# CSV Generator V1

Repositório para a página administrativa para geração de páginas para o Jardim Botânico de Santa Maria/RS (JBSM), podendo ser utilizado para outras finalidades futuramente.

Aplicação Vue 3 + Vite para processamento e transformação de arquivos CSV.

## Funcionalidades

- ✅ Upload de arquivo CSV ou importação via URL do Google Sheets
- ✅ Renomeação de colunas e reordenação
- ✅ Seleção e sanitização de colunas existentes
- ✅ Adição de novas colunas com valores fixos, fórmulas ou sequências
- ✅ **Geração de conteúdo com IA (Gemini API)**
- ✅ Exportação para arquivo CSV ou escrita direta no Google Sheets
- ✅ Interface passo-a-passo intuitiva
- ✅ Processamento 100% no navegador (sem servidor)

## Configuração

### Chave da API Gemini (Opcional)

Para habilitar a funcionalidade de geração de conteúdo com IA para todos os usuários:

1. Obtenha uma chave da API Gemini em: https://aistudio.google.com/app/apikey
2. Crie um arquivo `.env` na raiz do projeto (use `.env.example` como referência)
3. Adicione sua chave:
   ```
   VITE_GEMINI_API_KEY=sua_chave_aqui
   ```

**Para deployment no GitHub Pages/Netlify/Vercel:**
- Configure a variável de ambiente `VITE_GEMINI_API_KEY` nos secrets/environment variables
- A chave será incorporada no build e estará disponível para todos os usuários
- Usuários ainda podem usar suas próprias chaves se preferirem

## Planilha do site
O site do JBSM possui seu acervo baseado na planilha disponível [neste link](https://docs.google.com/spreadsheets/d/1jxPq1Pj7szd6Cw3uQq1l9N6iFCEAeLUR1bh978gJF9g/).