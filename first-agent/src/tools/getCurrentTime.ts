// Store the message callback function
let messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null = null;

// Function to set the message callback for tools
export function setMessageCallbackForTools(callback: (message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) {
  messageCallback = callback;
}

// Current time tool function
export function getCurrentTime(params: { format?: string; timezone?: string } = {}): any {
  console.log('🕒 get_current_time tool called with params:', params);
  
  const format = params.format || 'full';
  const timezone = params.timezone || 'Asia/Taipei';
  
  try {
    const now = new Date();
    
    // Get current date components
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const second = now.getSeconds();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[now.getDay()];
    
    let timeString = '';
    
    switch (format) {
      case 'full':
        timeString = `${year}年${month}月${day}日 ${weekday} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
        break;
      case 'time_only':
        timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
        break;
      case 'date_only':
        timeString = `${year}年${month}月${day}日 ${weekday}`;
        break;
      default:
        timeString = `${year}年${month}月${day}日 ${weekday} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`;
    }
    
    const result = {
      current_time: timeString,
      timestamp: now.toISOString(),
      timezone: timezone,
      format: format,
      year: year,
      month: month,
      day: day,
      hour: hour,
      minute: minute,
      second: second,
      weekday: weekday
    };
    
    console.log('🕒 Current time result:', result);
    console.log('🕒 Formatted time string:', timeString);
    
    // Also add message to conversation if callback is available
    if (messageCallback) {
      messageCallback({
        role: 'assistant',
        content: `🕒 查詢時間結果: ${timeString}`,
        timestamp: new Date(),
        isStreaming: false
      }, `time-tool-${Date.now()}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in get_current_time tool:', error);
    const errorResult = {
      error: 'Failed to get current time',
      message: String(error)
    };
    
    if (messageCallback) {
      messageCallback({
        role: 'assistant',
        content: `❌ 時間查詢失敗: ${String(error)}`,
        timestamp: new Date(),
        isStreaming: false
      }, `time-error-${Date.now()}`);
    }
    
    return errorResult;
  }
}

// Tool invoke function for the agent
async function getCurrentTimeInvoke(runContext: any, input: string): Promise<any> {
  console.log('🕒 Tool invoke called with input:', input);
  console.log('🕒 Run context:', runContext);
  
  let params = {};
  try {
    if (input && input.trim()) {
      params = JSON.parse(input);
    }
  } catch (e) {
    console.log('Using default parameters for tool invoke');
  }
  
  return getCurrentTime(params);
}

export const getCurrentTimeTool = {
  type: 'function',
  name: 'get_current_time',
  description: 'Get the current date and time. Use this when users ask about time, date, or current moment.',
  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        description: 'The format for the time display',
        enum: ['full', 'time_only', 'date_only'],
        default: 'full'
      },
      timezone: {
        type: 'string', 
        description: 'The timezone to display time in',
        default: 'Asia/Taipei'
      }
    },
    required: [],
    additionalProperties: false
  },
  strict: false,
  needsApproval: async () => false,
  invoke: getCurrentTimeInvoke
};
