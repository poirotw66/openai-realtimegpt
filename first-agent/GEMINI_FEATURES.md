# Gemini Live 功能說明

## 已實作功能

### 1. 連線後自動打招呼 ✅

當 Gemini Live 連線成功後，AI 會自動用繁體中文跟使用者打招呼。

**實作方式：**
- 在 `geminiLive.ts` 的 system instruction 中設定打招呼指令：
  ```typescript
  system_instruction: {
    parts: [{ text: 'You are a helpful assistant. You MUST respond only in Traditional Chinese (繁體中文) when the user speaks Chinese. When the conversation starts, greet them first by saying: 哈囉～有什麼可以幫你的？ Then wait for their response.' }]
  }
  ```

- 當收到 `setupComplete` 訊息時（第 93-98 行），自動觸發 AI 打招呼：
  ```typescript
  if (data?.setupComplete ?? (data as any)?.setup_complete) {
    console.log('Gemini Live: setup complete, triggering greeting.');
    sendGeminiTriggerGreeting();
    return;
  }
  ```

- `sendGeminiTriggerGreeting()` 函數發送一個包含 "。" 的使用者訊息來觸發模型回應（第 344-354 行）

### 2. 支援上傳音訊檔 ✅

使用者可以上傳音訊檔（WAV、MP3 等格式），上傳音訊等同於使用者說話，AI 會轉錄並回應。

**實作方式：**
- 在 `App.tsx` 的聊天介面中，有檔案上傳 input 和傳送按鈕（第 262-281 行）
- `handleSendTestAudio` 函數處理檔案上傳（第 165-183 行），針對 Gemini Live 使用 `sendGeminiAudioFromFile()` 函數
- `sendGeminiAudioFromFile()` 函數在 `geminiLive.ts`（第 377-396 行）：
  - 將音訊檔轉換為 16kHz PCM 格式
  - 分成小塊（每塊約 100ms）發送給 Gemini Live
  - Gemini 會自動轉錄音訊並產生回應

**使用方式：**
1. 連接到 Gemini Live
2. 在聊天介面下方點擊「測試音檔」選擇音訊檔
3. 點擊「傳送」按鈕
4. AI 會轉錄音訊內容並用語音回應

### 3. 即時語音對話 ✅

支援即時麥克風輸入，使用者說話會即時轉錄並由 AI 回應。

**實作方式：**
- `startGeminiMicrophone()` 函數（第 287-323 行）啟動麥克風串流
- 使用 AudioWorklet 或 ScriptProcessor 捕捉音訊
- 自動重新取樣到 16kHz 並轉換為 PCM16 格式
- 即時發送到 Gemini Live API

## 與 GPT Realtime 的一致性

現在 Gemini Live 的實作與 GPT Realtime 功能一致：

| 功能 | GPT Realtime | Gemini Live |
|------|-------------|------------|
| 連線後自動打招呼 | ✅ | ✅ |
| 上傳音訊檔 | ✅ | ✅ |
| 即時語音對話 | ✅ | ✅ |
| 繁體中文回應 | ✅ | ✅ |

## 注意事項

1. Gemini Live 需要 Google Cloud 專案 ID
2. 需要執行 `gcloud auth application-default login` 進行身份驗證
3. 需要使用 `npm run dev-full` 同時啟動 proxy 和前端
4. Gemini Live 不支援暫停功能（與 GPT Realtime 不同）
