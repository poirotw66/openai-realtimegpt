# Gemini Live 整合說明

## 架構變更

已將 Gemini Live 整合改為使用 Python 後端 + google-genai SDK，參考 plain-js-python-sdk-demo-app 的實作方式。

### 新增檔案

1. **gemini_backend.py** - Python FastAPI 後端，處理 Gemini Live WebSocket 連接
2. **requirements.txt** - Python 依賴套件

### 修改檔案

1. **src/geminiLive.ts** - 前端改為連接 Python 後端而非直接連接 Vertex AI
2. **package.json** - 新增 `gemini-backend` 和更新 `dev-full` 腳本

## 安裝與執行

### 1. 安裝 Python 依賴

```bash
cd first-agent
pip install -r requirements.txt
```

或使用虛擬環境：

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 設定環境變數

在 `first-agent/.env` 中設定：

```bash
GOOGLE_CLOUD_PROJECT=your-project-id
```

### 3. 執行

```bash
npm run dev-full
```

這會同時啟動：
- Node.js MCP proxy server (port 3001)
- Python Gemini backend (port 8001)
- Vite dev server (port 5173)

## 測試

1. 開啟 http://localhost:5173
2. 選擇 "Gemini Live"
3. 在設定中輸入你的 Google Cloud Project ID（如果已在 .env 設定則會自動使用）
4. 點擊連接，開始對話

## 錯誤排查

- **WebSocket connection failed**: 確認 Python 後端已啟動 (port 8001)
- **GOOGLE_CLOUD_PROJECT not set**: 檢查 .env 檔案
- **google-genai package not installed**: 執行 `pip install -r requirements.txt`
- **Authentication failed**: 執行 `gcloud auth application-default login`
