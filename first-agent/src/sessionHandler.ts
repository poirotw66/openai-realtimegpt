// Chinese S2T conversion - lightweight and browser-compatible
import { DISPLAY_LANGUAGE } from './agent';
import { s2t } from 'chinese-s2t';

// Professional conversion function using chinese-s2t
function convertToTraditional(text: string): string {
    if (DISPLAY_LANGUAGE !== 'zh-TW' || !text) return text;
    
    try {
        const converted = s2t(text);
        
        if (converted !== text) {
            console.log('🔄 chinese-s2t converted:', text, '→', converted);
        }
        
        return converted;
    } catch (error) {
        console.error('Chinese S2T conversion error:', error);
        return text; // Return original text if conversion fails
    }
}

/** Item shape from API (event.item) or SDK history (itemId, content). */
type ConversationItemLike = {
    id?: string;
    itemId?: string;
    role?: string;
    content?: Array<{ type?: string; text?: string; transcript?: string | null }>;
};

/**
 * Extract user message text from conversation item content (input_text or input_audio transcript).
 * Works with both API event.item and SDK history items.
 */
function getUserMessageTextFromItem(item: ConversationItemLike): string | null {
    if (item.role !== 'user' || !Array.isArray(item.content)) return null;
    for (const part of item.content) {
        if (part.type === 'input_text' && part.text != null) return String(part.text).trim();
        if ((part.type === 'input_audio' || part.type === 'input_audio_transcription') && part.transcript != null) return String(part.transcript).trim();
    }
    return null;
}

/** Get stable id for an item (API uses id, SDK history uses itemId). */
function getItemId(item: ConversationItemLike): string {
    return item.itemId ?? item.id ?? '';
}

/**
 * Push a user message to the UI once per item (dedup by itemId). Returns true if pushed.
 */
function pushUserMessageOnce(
    userItemIdsSent: Set<string>,
    messageCallback: ((message: { role: 'user'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null,
    content: string,
    itemId: string
): boolean {
    if (!messageCallback || !content || !String(content).trim()) return false;
    if (itemId && userItemIdsSent.has(itemId)) return false;
    if (itemId) userItemIdsSent.add(itemId);
    messageCallback(
        { role: 'user', content: convertToTraditional(String(content).trim()), timestamp: new Date(), isStreaming: false },
        `user-${itemId || Date.now()}`
    );
    return true;
}

/**
 * Session emits raw API events via 'transport_event' (single event type with event object as payload).
 * We handle user transcription and assistant text/audio transcript from those events.
 * User text can come from input_audio_transcription.delta/completed OR from conversation.item.retrieved (after SDK requests retrieve).
 * We also listen to transport directly and session history_updated as fallbacks.
 * @returns A function that flushes user messages from session history into the UI (e.g. after sending test audio).
 */
export function setupEventHandlers(session: any, messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null): () => void {
    const sessionAny = session as any;

    if (!sessionAny.on) {
        console.log('❌ No event listener methods found on session');
        return () => {};
    }

    let currentUserMessage = '';
    let currentAssistantMessage = '';
    let userMessageId = '';
    let assistantMessageId = '';
    let finalAssistantMessageSentForTurn = false;
    const userItemIdsSent = new Set<string>();

    function handleTransportEvent(event: { type: string; delta?: string; transcript?: string; text?: string; item_id?: string; item?: { id?: string; role?: string; content?: Array<{ type?: string; text?: string; transcript?: string }> }; response_id?: string }) {
        if (!messageCallback) return;

        switch (event.type) {
            case 'conversation.item.input_audio_transcription.delta':
                if (event.delta) {
                    currentUserMessage += event.delta;
                    const itemId = (event as any).item_id ?? '';
                    if (!userMessageId) userMessageId = itemId ? `user-${itemId}` : `user-${Date.now()}`;
                    messageCallback({
                        role: 'user',
                        content: convertToTraditional(currentUserMessage),
                        timestamp: new Date(),
                        isStreaming: true
                    }, userMessageId);
                }
                break;
            case 'conversation.item.input_audio_transcription.completed': {
                const transcript = (event as any).transcript ?? event.text ?? currentUserMessage;
                const itemId = (event as any).item_id ?? event.item_id ?? '';
                if (transcript && String(transcript).trim() && !userItemIdsSent.has(itemId)) {
                    if (itemId) userItemIdsSent.add(itemId);
                    // If we have a streaming message, update it to final
                    if (userMessageId && messageCallback) {
                        messageCallback({
                            role: 'user',
                            content: convertToTraditional(String(transcript).trim()),
                            timestamp: new Date(),
                            isStreaming: false
                        }, userMessageId);
                    } else {
                        // Create new message if no streaming message exists
                        const messageId = itemId ? `user-${itemId}` : `user-${Date.now()}`;
                        if (messageCallback) {
                            messageCallback({
                                role: 'user',
                                content: convertToTraditional(String(transcript).trim()),
                                timestamp: new Date(),
                                isStreaming: false
                            }, messageId);
                        }
                    }
                }
                currentUserMessage = '';
                userMessageId = '';
                break;
            }
            case 'conversation.item.retrieved':
            case 'conversation.item.added':
            case 'conversation.item.done': {
                const item = event.item as ConversationItemLike | undefined;
                if (!item || item.role !== 'user') break;
                const itemId = getItemId(item);
                const text = getUserMessageTextFromItem(item);
                
                // Check if this is a text input (not audio transcription)
                const isTextInput = item.content?.some(part => part.type === 'input_text');
                
                if (text && !userItemIdsSent.has(itemId)) {
                    // Skip text input messages as they are already displayed immediately in UI
                    if (!isTextInput) {
                        userItemIdsSent.add(itemId);
                        userMessageId = `user-${itemId || Date.now()}`;
                        messageCallback({
                            role: 'user',
                            content: text,
                            timestamp: new Date(),
                            isStreaming: false
                        }, userMessageId);
                    } else {
                        // Mark text input as sent to prevent duplication
                        userItemIdsSent.add(itemId);
                    }
                }
                if (itemId) userMessageId = '';
                currentUserMessage = '';
                break;
            }
            case 'response.output_text.delta':
            case 'response.output_audio_transcript.delta':
                if (event.delta) {
                    currentAssistantMessage += event.delta;
                    if (!assistantMessageId) assistantMessageId = `assistant-${Date.now()}`;
                    messageCallback({
                        role: 'assistant',
                        content: currentAssistantMessage,
                        timestamp: new Date(),
                        isStreaming: true
                    }, assistantMessageId);
                }
                break;
            case 'response.output_text.done':
                if (event.text != null && !finalAssistantMessageSentForTurn) {
                    messageCallback({
                        role: 'assistant',
                        content: String(event.text),
                        timestamp: new Date(),
                        isStreaming: false
                    }, assistantMessageId);
                    finalAssistantMessageSentForTurn = true;
                    currentAssistantMessage = '';
                    assistantMessageId = '';
                }
                break;
            case 'response.output_audio_transcript.done':
                if (event.transcript != null && !finalAssistantMessageSentForTurn) {
                    messageCallback({
                        role: 'assistant',
                        content: String(event.transcript),
                        timestamp: new Date(),
                        isStreaming: false
                    }, assistantMessageId);
                    finalAssistantMessageSentForTurn = true;
                    currentAssistantMessage = '';
                    assistantMessageId = '';
                }
                break;
            case 'response.created':
                assistantMessageId = (event as any).response?.id ?? `assistant-${Date.now()}`;
                currentAssistantMessage = '';
                finalAssistantMessageSentForTurn = false;
                break;
            case 'input_audio_buffer.speech_started':
                userMessageId = `user-${Date.now()}`;
                currentUserMessage = '';
                break;
            default:
                break;
        }
    }

    session.on('transport_event', handleTransportEvent);

    /** Push user messages from session history (fallback when transport_event misses or fires in different order). */
    function pushUserMessagesFromHistory(history: Array<ConversationItemLike>) {
        if (!Array.isArray(history)) return;
        for (const item of history) {
            if (item.role !== 'user') continue;
            const itemId = getItemId(item);
            const text = getUserMessageTextFromItem(item);
            if (text && itemId) pushUserMessageOnce(userItemIdsSent, messageCallback, text, itemId);
        }
    }

    // Only use history_updated for fallback, avoid duplicate listeners
    session.on('history_updated', (history: unknown) => {
        const list = Array.isArray(history) ? (history as ConversationItemLike[]) : (sessionAny.history ? (sessionAny.history as ConversationItemLike[]) : []);
        pushUserMessagesFromHistory(list);
    });

    /** Flush user messages from current session history (call after e.g. sendAudioFromFile so test-audio transcript appears). */
    function flushUserMessagesFromHistory() {
        const history = sessionAny.history;
        if (Array.isArray(history)) pushUserMessagesFromHistory(history as ConversationItemLike[]);
    }

    console.log('✅ Event handlers registered (transport_event, history_updated).');
    return flushUserMessagesFromHistory;
}