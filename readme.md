# 使用方法

## 啟動 agent
1. 在專案根目錄或 `first-agent` 建立 `.env`，設定 `OPENAI_API_KEY=你的金鑰`。
2. 啟動：
```
cd first-agent
npm run dev-full
```
3. 開啟 http://localhost:5173/，點擊「Connect to Voice Assistant」。  
   前端會透過後端自動用 `.env` 的 `OPENAI_API_KEY` 向 OpenAI 取得 ephemeral token，無需手動 curl。

## 手動取得 client ephemeral token（選用）
若需要自行取得 token 測試，可呼叫後端 API：
```
curl -X POST http://localhost:3001/api/realtime/client_secret \
  -H "Content-Type: application/json" \
  -d '{"session":{"type":"realtime","model":"gpt-realtime"}}'
```
或使用 OpenAI API（需先 `export OPENAI_API_KEY=你的金鑰`）：
```
curl -X POST https://api.openai.com/v1/realtime/client_secrets \
   -H "Authorization: Bearer $OPENAI_API_KEY" \
   -H "Content-Type: application/json" \
   -d '{"session":{"type":"realtime","model":"gpt-realtime"}}'
```

## 費用說明

realtime-gpt
1.22 > 1.13
token:26268 > 26699

gpt4o-mini
token 919 > 977

Thought: 使用者的問題是「如何在手機上安裝 Teams」，這屬於「操作教學類」。我已經檢索到相關文件，其中提到了安裝 Teams 的步驟，以及 Android 和 iOS 系統需要安裝的額外應用程式。我需要整合這些資訊，並按照操作教學類的結構來回答。

【開場說明】：簡要說明此功能的用途或常見情境。
【操作步驟】：使用條列式 (1., 2., 3., ...) 詳細說明每一步，清楚標示工具位置與按鈕名稱。
【延伸資源】：(如果檢索內容有提供) 附上相關的教學影片或官方文件連結。

目前資訊：
- Teams 是 M365 行動 APP 之一，需要從應用程式商店下載。
- 安裝步驟包含：下載 M365 APP、綁定行動裝置、登入 M365 APP。
- iOS 系統需要安裝 Authenticator。
- Android 系統需要安裝 Authenticator 和 Intune 公司入口網站。
- 銀行同仁需要聯繫資服詢問申請。
- 提醒不要下載 Microsoft 365 (Office) App。

我已經有足夠的資訊來回答這個問題。我會將這些資訊整理成操作教學類的回答結構。
【操作教學類】

### 開場說明
您可以在手機上安裝 Microsoft Teams 應用程式，以便隨時隨地進行協作與溝通。安裝過程主要分為下載應用程式、綁定行動裝置及登入三個步驟。

### 操作步驟
1.  **下載 M365 APP**：
    *   進入您手機的應用程式商店（例如：App Store 或 Google Play）。
    *   搜尋並下載以下必要的應用程式：
        *   **Teams**
        *   **Outlook**
        *   **OneDrive**
        *   **SharePoint**
    *   根據您的手機系統，還需下載綁定必要的應用程式：
        *   **iOS 系統**：下載 **Authenticator**
        *   **Android 系統**：下載 **Authenticator** 和 **Intune 公司入口網站**
    *   **重要提醒**：請不要下載 **Microsoft 365 (Office) App**。
2.  **綁定行動裝置**：
    *   請準備好您的桌機或筆電，打開瀏覽器登入 M365 首頁 Office.com。
    *   使用您的公司 E-mail 帳號和電腦內網開機密碼進行登入。
    *   綁定詳細步驟請參考相關說明文件。
    *   **請注意**：Android 系統裝置的綁定程序較多，請特別留意。
3.  **登入 M365 APP**：
    *   完成上述步驟後，即可使用您的公司帳號登入已安裝的 Teams 應用程式。

### 延伸資源
*   M365行動APP安裝說明_20250618 (Page: 5, 6, 7, 10, 25)
*   一萬個為甚麼.xlsx (Row: 12)

**特別提醒銀行同仁**：若您是銀行同仁，請聯繫資服單位詢問相關申請事宜。


## gpt4o mini

price: 1.13


1.22 > 1.13 > 1.04
token:26268 > 26699

gpt4o-mini
token 919 > 977 > 1043