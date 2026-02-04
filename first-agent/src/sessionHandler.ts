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
        { role: 'user', content: String(content).trim(), timestamp: new Date(), isStreaming: false },
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
                    if (!userMessageId) userMessageId = `user-${Date.now()}`;
                    messageCallback({
                        role: 'user',
                        content: currentUserMessage,
                        timestamp: new Date(),
                        isStreaming: true
                    }, userMessageId);
                }
                break;
            case 'conversation.item.input_audio_transcription.completed': {
                const transcript = (event as any).transcript ?? event.text ?? currentUserMessage;
                const itemId = (event as any).item_id ?? event.item_id ?? '';
                if (transcript && String(transcript).trim()) {
                    pushUserMessageOnce(userItemIdsSent, messageCallback, String(transcript).trim(), itemId);
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
                if (text && !userItemIdsSent.has(itemId)) {
                    userItemIdsSent.add(itemId);
                    userMessageId = `user-${itemId || Date.now()}`;
                    messageCallback({
                        role: 'user',
                        content: text,
                        timestamp: new Date(),
                        isStreaming: false
                    }, userMessageId);
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

    session.on('history_updated', (history: unknown) => {
        const list = Array.isArray(history) ? (history as ConversationItemLike[]) : (sessionAny.history ? (sessionAny.history as ConversationItemLike[]) : []);
        pushUserMessagesFromHistory(list);
    });

    session.on('history_added', (item: unknown) => {
        const historyItem = item as ConversationItemLike;
        if (historyItem?.role !== 'user') return;
        const itemId = getItemId(historyItem);
        const text = getUserMessageTextFromItem(historyItem);
        if (text && itemId) pushUserMessageOnce(userItemIdsSent, messageCallback, text, itemId);
    });

    // Direct transport listeners (base emits by event type); ensures we get user transcription even if transport_event payload differs
    const transport = sessionAny.transport;
    if (transport && typeof transport.on === 'function') {
        transport.on('conversation.item.input_audio_transcription.completed', (event: { transcript?: string; item_id?: string }) => {
            const transcript = event?.transcript ?? (event as any).transcript;
            const itemId = event?.item_id ?? (event as any).item_id ?? '';
            if (transcript && String(transcript).trim()) {
                pushUserMessageOnce(userItemIdsSent, messageCallback, String(transcript).trim(), itemId);
            }
        });
        
        transport.on('conversation.item.retrieved', (event: { item?: ConversationItemLike }) => {
            const item = event?.item ?? (event as any).item;
            if (!item || item.role !== 'user') return;
            const itemId = getItemId(item);
            const text = getUserMessageTextFromItem(item);
            if (text && itemId) pushUserMessageOnce(userItemIdsSent, messageCallback, text, itemId);
        });
    }

    // Do NOT also push from agent_end: we already get final text from
    // response.output_text.done or response.output_audio_transcript.done.
    // Pushing from both causes the same AI reply to appear twice in the UI.

    /** Flush user messages from current session history (call after e.g. sendAudioFromFile so test-audio transcript appears). */
    function flushUserMessagesFromHistory() {
        const history = sessionAny.history;
        if (Array.isArray(history)) pushUserMessagesFromHistory(history as ConversationItemLike[]);
    }

    console.log('✅ Event handlers registered (transport_event, history_updated, history_added).');
    return flushUserMessagesFromHistory;
}