# OpenAI Realtime Agent with Tools

這是一個使用 OpenAI Realtime API 和 `@openai/agents-realtime` SDK 構建的智能對話系統，支持實時語音對話和工具調用功能。

## 🚀 功能特色

- **實時語音對話**：支持語音輸入和語音輸出
- **實時文字串流**：對話內容即時顯示在界面上
- **工具調用**：AI 可以調用自定義工具（如查詢當前時間）
- **雙語支持**：中文和英文智能切換
- **調試功能**：完整的事件監聽和調試面板

## 📋 系統要求

- Node.js 16+ 
- 現代瀏覽器（支持 WebRTC）
- OpenAI API Key

## 🛠️ 安裝與運行

### 1. 安裝依賴
```bash
npm install
```

### 2. 啟動開發服務器
```bash
npm run dev
```

### 3. 開啟瀏覽器
打開 http://localhost:5173/

### 4. 配置 API Key
在界面中輸入你的 OpenAI API Key 並點擊連接

## 🔧 工具配置

### 當前可用工具

#### `get_current_time`
- **功能**：查詢當前日期和時間
- **參數**：
  - `format`: 時間格式 (`'full'` | `'time_only'` | `'date_only'`)
  - `timezone`: 時區 (預設: `'Asia/Taipei'`)
- **使用方式**：向 AI 詢問 "現在幾點？" 或 "今天是幾號？"

### 添加新工具

1. **定義工具函數**
```typescript
function myToolFunction(params: any): any {
  // 工具邏輯
  return result;
}

async function myToolInvoke(runContext: any, input: string): Promise<any> {
  let params = {};
  try {
    if (input && input.trim()) {
      params = JSON.parse(input);
    }
  } catch (e) {
    // 使用預設參數
  }
  return myToolFunction(params);
}
```

2. **在 Agent 中註冊工具**
```typescript
const agent = new RealtimeAgent({
  tools: [
    {
      type: 'function',
      name: 'my_tool',
      description: '工具描述',
      parameters: {
        type: 'object',
        properties: {
          // 參數定義
        },
        required: [],
        additionalProperties: false
      },
      strict: false,
      needsApproval: async () => false,
      invoke: myToolInvoke
    }
  ]
});
```

## 🏗️ 項目結構

```
src/
├── agent.ts          # Realtime Agent 核心邏輯
├── App.tsx           # React 主應用
├── App.css           # 樣式定義
├── main.tsx          # 應用入口
└── vite-env.d.ts     # TypeScript 聲明
```

## 🎯 核心實現

### Agent 配置
```typescript
const agent = new RealtimeAgent({
  name: 'Assistant',
  instructions: '智能助手指令',
  tools: [/* 工具定義 */]
});

const session = new RealtimeSession(agent, {
  model: 'gpt-4o-mini-realtime-preview'
});
```

### 事件監聽
```typescript
session.on('response.text.delta', (event) => {
  // 處理實時文字串流
});

session.on('conversation.item.input_audio_transcription.delta', (event) => {
  // 處理語音識別結果
});
```

### 工具調用流程
1. 用戶詢問需要工具的問題
2. AI 自動識別並調用對應工具
3. 工具執行並返回結果
4. AI 基於工具結果生成回應

## 🐛 調試功能

### 測試按鈕
- 🧪 測試 AI 回應
- 🎤 測試語音識別  
- 🔧 測試事件系統
- 🕒 測試時間工具
- ⏰ 模擬時間查詢

### 控制台日志
- 🌟 事件監聽
- 🕒 工具調用
- 📤 數據傳輸
- ❌ 錯誤信息

## 🔍 常見問題

### Q: AI 不調用工具怎麼辦？
A: 確保工具在 `RealtimeAgent` 創建時就配置，不要在連接後配置。

### Q: 工具調用失敗怎麼辦？
A: 檢查 `invoke` 函數簽名是否正確：
```typescript
async function toolInvoke(runContext: any, input: string): Promise<any>
```

### Q: 語音識別不工作？
A: 確保瀏覽器允許麥克風權限，並且使用 HTTPS 或 localhost。

## 📚 相關資源

- [OpenAI Realtime API 文檔](https://platform.openai.com/docs/api-reference/realtime)
- [@openai/agents-realtime SDK](https://www.npmjs.com/package/@openai/agents-realtime)
- [React 官方文檔](https://react.dev/)
- [Vite 官方文檔](https://vitejs.dev/)

## 🔐 安全注意事項

- 不要在客戶端代碼中硬編碼 API Key
- 生產環境中使用後端代理 API 調用
- 定期檢查 API 使用量

## 📄 許可證

MIT License

---

## 🎉 更新日志

### v1.0.0 (2025-09-03)
- ✅ 實現 Realtime API 集成
- ✅ 支持實時語音對話
- ✅ 支持實時文字串流
- ✅ 實現工具調用功能 (`get_current_time`)
- ✅ 完整的調試和測試功能
- ✅ 解決工具不被調用的關鍵問題
