import React, { useState, useEffect } from 'react';
import { 
  getAllConversations, 
  deleteConversation, 
  downloadConversation,
  type Conversation 
} from '../utils/conversationHistory';
import { IconArrowLeft, IconPhoneOff } from './Icons';

interface ConversationHistoryProps {
  onBack: () => void;
  onLoadConversation: (conversation: Conversation) => void;
}

const ConversationHistory: React.FC<ConversationHistoryProps> = ({ 
  onBack, 
  onLoadConversation 
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = () => {
    const all = getAllConversations();
    setConversations(all);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('確定要刪除這個對話嗎？')) {
      deleteConversation(id);
      loadConversations();
      if (selectedId === id) {
        setSelectedId(null);
      }
    }
  };

  const handleExport = (conversation: Conversation, format: 'json' | 'markdown' | 'txt', e: React.MouseEvent) => {
    e.stopPropagation();
    downloadConversation(conversation, format);
  };

  const filteredConversations = conversations.filter(conv => 
    conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.messages.some(msg => msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedConversation = selectedId 
    ? conversations.find(c => c.id === selectedId) 
    : null;

  return (
    <div className="conversation-history-view">
      <div className="conversation-history-header">
        <button type="button" className="back-btn" onClick={onBack} aria-label="返回">
          <IconArrowLeft width={20} height={20} />
          <span>返回</span>
        </button>
        <h2>對話歷史</h2>
      </div>

      <div className="conversation-history-content">
        <div className="conversation-list-panel">
          <div className="conversation-search">
            <input
              type="text"
              placeholder="搜尋對話..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="conversation-list">
            {filteredConversations.length === 0 ? (
              <div className="empty-state">
                {searchQuery ? '沒有找到符合的對話' : '還沒有對話記錄'}
              </div>
            ) : (
              filteredConversations.map(conv => (
                <div
                  key={conv.id}
                  className={`conversation-item ${selectedId === conv.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div className="conversation-item-header">
                    <h3 className="conversation-title">{conv.title}</h3>
                    <div className="conversation-meta">
                      <span className="conversation-model">
                        {conv.model === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live'}
                      </span>
                      <span className="conversation-date">
                        {conv.updatedAt.toLocaleDateString('zh-TW', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="conversation-preview">
                    {conv.messages.length > 0 && (
                      <p>{conv.messages[0].content.slice(0, 100)}...</p>
                    )}
                  </div>
                  <div className="conversation-actions">
                    <button
                      type="button"
                      className="btn-load"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadConversation(conv);
                      }}
                      title="載入對話到聊天視圖"
                    >
                      查看
                    </button>
                    <div className="export-buttons">
                      <button
                        type="button"
                        className="btn-export"
                        onClick={(e) => handleExport(conv, 'json', e)}
                        title="匯出為 JSON"
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        className="btn-export"
                        onClick={(e) => handleExport(conv, 'markdown', e)}
                        title="匯出為 Markdown"
                      >
                        MD
                      </button>
                      <button
                        type="button"
                        className="btn-export"
                        onClick={(e) => handleExport(conv, 'txt', e)}
                        title="匯出為文字檔"
                      >
                        TXT
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn-delete"
                      onClick={(e) => handleDelete(conv.id, e)}
                      aria-label="刪除對話"
                    >
                      <IconPhoneOff width={16} height={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedConversation && (
          <div className="conversation-detail-panel">
            <div className="conversation-detail-header">
              <h3>{selectedConversation.title}</h3>
              <div className="conversation-detail-meta">
                <span>模型: {selectedConversation.model === 'gpt-realtime' ? 'GPT Realtime' : 'Gemini Live'}</span>
                <span>建立時間: {selectedConversation.createdAt.toLocaleString('zh-TW')}</span>
                <span>更新時間: {selectedConversation.updatedAt.toLocaleString('zh-TW')}</span>
                <span>訊息數: {selectedConversation.messages.length}</span>
              </div>
            </div>
            <div className="conversation-detail-content">
              {selectedConversation.messages.map((msg, idx) => (
                <div key={msg.messageId || idx} className={`message-preview ${msg.role}`}>
                  <div className="message-preview-header">
                    <span>{msg.role === 'user' ? '您' : 'AI'}</span>
                    <span className="message-preview-time">
                      {msg.timestamp.toLocaleTimeString('zh-TW')}
                    </span>
                  </div>
                  <div className="message-preview-content">{msg.content}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationHistory;
