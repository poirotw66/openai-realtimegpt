/**
 * Conversation History Management
 * Handles saving, loading, and managing conversation history in localStorage
 */

export interface Conversation {
  id: string;
  title: string;
  model: 'gpt-realtime' | 'gemini-live';
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  messageId?: string;
}

const STORAGE_KEY = 'realtimegpt_conversations';
const MAX_CONVERSATIONS = 100; // Limit number of stored conversations

/**
 * Get all conversations from localStorage
 */
export function getAllConversations(): Conversation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const conversations = JSON.parse(stored) as Conversation[];
    // Convert date strings back to Date objects
    return conversations.map(conv => ({
      ...conv,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
      messages: conv.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }))
    }));
  } catch (error) {
    console.error('Error loading conversations:', error);
    return [];
  }
}

/**
 * Save a conversation to localStorage
 */
export function saveConversation(conversation: Conversation): void {
  try {
    const conversations = getAllConversations();
    
    // Remove existing conversation with same ID if it exists
    const filtered = conversations.filter(c => c.id !== conversation.id);
    
    // Add updated conversation
    filtered.push(conversation);
    
    // Sort by updatedAt (newest first) and limit
    filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const limited = filtered.slice(0, MAX_CONVERSATIONS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
}

/**
 * Create a new conversation from current messages
 */
export function createConversation(
  messages: Message[],
  model: 'gpt-realtime' | 'gemini-live',
  title?: string
): Conversation {
  const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  
  // Generate title from first user message if not provided
  const conversationTitle = title || 
    messages.find(m => m.role === 'user')?.content.slice(0, 50) || 
    '新對話';
  
  return {
    id,
    title: conversationTitle,
    model,
    messages: messages.filter(m => !m.isStreaming), // Only save completed messages
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Update an existing conversation
 */
export function updateConversation(
  conversationId: string,
  updates: Partial<Conversation>
): void {
  const conversations = getAllConversations();
  const index = conversations.findIndex(c => c.id === conversationId);
  
  if (index !== -1) {
    conversations[index] = {
      ...conversations[index],
      ...updates,
      updatedAt: new Date()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }
}

/**
 * Delete a conversation
 */
export function deleteConversation(conversationId: string): void {
  try {
    const conversations = getAllConversations();
    const filtered = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting conversation:', error);
  }
}

/**
 * Get a conversation by ID
 */
export function getConversation(conversationId: string): Conversation | null {
  const conversations = getAllConversations();
  return conversations.find(c => c.id === conversationId) || null;
}

/**
 * Export conversation as JSON
 */
export function exportConversationAsJSON(conversation: Conversation): string {
  return JSON.stringify(conversation, null, 2);
}

/**
 * Export conversation as Markdown
 */
export function exportConversationAsMarkdown(conversation: Conversation): string {
  const lines = [
    `# ${conversation.title}`,
    '',
    `**Model:** ${conversation.model === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live'}`,
    `**Created:** ${conversation.createdAt.toLocaleString('zh-TW')}`,
    `**Updated:** ${conversation.updatedAt.toLocaleString('zh-TW')}`,
    '',
    '---',
    ''
  ];
  
  conversation.messages.forEach(msg => {
    const role = msg.role === 'user' ? '您' : 'AI';
    const time = msg.timestamp.toLocaleTimeString('zh-TW');
    lines.push(`## ${role} (${time})`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Export conversation as plain text
 */
export function exportConversationAsText(conversation: Conversation): string {
  const lines = [
    conversation.title,
    '',
    `Model: ${conversation.model === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live'}`,
    `Created: ${conversation.createdAt.toLocaleString('zh-TW')}`,
    `Updated: ${conversation.updatedAt.toLocaleString('zh-TW')}`,
    '',
    '='.repeat(50),
    ''
  ];
  
  conversation.messages.forEach(msg => {
    const role = msg.role === 'user' ? '您' : 'AI';
    const time = msg.timestamp.toLocaleTimeString('zh-TW');
    lines.push(`${role} (${time}):`);
    lines.push(msg.content);
    lines.push('');
  });
  
  return lines.join('\n');
}

/**
 * Download conversation as file
 */
export function downloadConversation(
  conversation: Conversation,
  format: 'json' | 'markdown' | 'txt' = 'json'
): void {
  let content: string;
  let filename: string;
  let mimeType: string;
  
  switch (format) {
    case 'json':
      content = exportConversationAsJSON(conversation);
      filename = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}.json`;
      mimeType = 'application/json';
      break;
    case 'markdown':
      content = exportConversationAsMarkdown(conversation);
      filename = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}.md`;
      mimeType = 'text/markdown';
      break;
    case 'txt':
      content = exportConversationAsText(conversation);
      filename = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
      mimeType = 'text/plain';
      break;
  }
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
