export function setupEventHandlers(session: any, messageCallback: ((message: { role: 'user' | 'assistant'; content: string; timestamp: Date; isStreaming?: boolean }, messageId?: string) => void) | null) {
    const sessionAny = session as any;

    if (!sessionAny.on) {
        console.log('❌ No event listener methods found on session');
        return;
    }

    let currentUserMessage = '';
    let currentAssistantMessage = '';
    let userMessageId = '';
    let assistantMessageId = '';

    session.on('conversation.item.input_audio_transcription.delta', (event: any) => {
        if (event.delta) {
            currentUserMessage += event.delta;
            if (!userMessageId) {
                userMessageId = `user-${Date.now()}`;
            }
            if (messageCallback) {
                messageCallback({
                    role: 'user',
                    content: currentUserMessage,
                    timestamp: new Date(),
                    isStreaming: true
                }, userMessageId);
            }
        }
    });

    session.on('conversation.item.input_audio_transcription.completed', (event: any) => {
        const transcript = event.transcript || event.text || event.content;
        if (transcript) {
            if (messageCallback) {
                messageCallback({
                    role: 'user',
                    content: transcript,
                    timestamp: new Date(),
                    isStreaming: false
                }, userMessageId);
            }
            currentUserMessage = '';
            userMessageId = '';
        }
    });

    session.on('response.text.delta', (event: any) => {
        if (event.delta) {
            currentAssistantMessage += event.delta;
            if (!assistantMessageId) {
                assistantMessageId = `assistant-${Date.now()}`;
            }
            if (messageCallback) {
                messageCallback({
                    role: 'assistant',
                    content: currentAssistantMessage,
                    timestamp: new Date(),
                    isStreaming: true
                }, assistantMessageId);
            }
        }
    });

    session.on('response.text.done', (event: any) => {
        const content = event.text;
        if (content) {
            if (messageCallback) {
                messageCallback({
                    role: 'assistant',
                    content: content,
                    timestamp: new Date(),
                    isStreaming: false
                }, assistantMessageId);
            }
            currentAssistantMessage = '';
            assistantMessageId = '';
        }
    });

    session.on('response.created', (event: any) => {
        assistantMessageId = event.response?.id || `assistant-${Date.now()}`;
        currentAssistantMessage = '';
    });

    session.on('input_audio_buffer.speech_started', () => {
        userMessageId = `user-${Date.now()}`;
        currentUserMessage = '';
    });

    console.log('✅ Simplified event handlers registered.');
}