import React, { useState, useRef, useEffect } from 'react';
import './AIAssistantPanel.scss';
import { 
  RiCloseLine, 
  RiSettings3Line, 
  RiDeleteBin6Line, 
  RiArrowLeftLine, 
  RiArrowRightLine,
  RiSendPlaneLine,
  RiBrainLine,
  RiTerminalBoxLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLightbulbLine,
  RiCpuLine,
  RiCodeLine,
  RiFileTextLine,
  RiPlayLine,
  RiPulseLine,
  RiLoader4Line,
  RiSparklingLine,
  RiAppsLine
} from 'react-icons/ri';
import { 
  FiUser, 
  FiCpu, 
  FiZap, 
  FiCheck, 
  FiAlertTriangle,
  FiTool,
  FiActivity
} from 'react-icons/fi';
import { 
  HiOutlineSparkles,
  HiOutlineLightBulb,
  HiOutlineCog,
  HiOutlineTerminal
} from 'react-icons/hi';
import PromptTemplatesModal from './PromptTemplatesModal';
import { aiService, AIMessage, AIProgressUpdate } from '../services/aiService';
import AIConfigModal from './AIConfigModal';

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  onOpenFileExplorer?: (path: string, reason: string) => void;
  onOpenFileEditor?: (filepath: string, reason: string) => void;
}

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ 
  isOpen, 
  onClose, 
  sessionId, 
  onOpenFileExplorer, 
  onOpenFileEditor 
}) => {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: '1',
      content: "Hello! I'm your AI assistant. I can help you navigate your server, execute commands, and analyze your system. What would you like to do today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [progressUpdates, setProgressUpdates] = useState<AIProgressUpdate[]>([]);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, progressUpdates]);

  // Check AI configuration
  useEffect(() => {
    setIsConfigured(aiService.isConfigured());
  }, [isOpen]);

  // Manage body classes for panel state
  useEffect(() => {
    const body = document.body;
    
    if (isOpen) {
      if (isCollapsed) {
        body.classList.add('ai-panel-collapsed');
        body.classList.remove('ai-panel-open');
      } else {
        body.classList.add('ai-panel-open');
        body.classList.remove('ai-panel-collapsed');
      }
    } else {
      body.classList.remove('ai-panel-open', 'ai-panel-collapsed');
    }

    return () => {
      body.classList.remove('ai-panel-open', 'ai-panel-collapsed');
    };
  }, [isOpen, isCollapsed]);

  // Listen for AI tool events
  useEffect(() => {
    const handleFileExplorer = (event: CustomEvent) => {
      const { path, reason } = event.detail;
      if (onOpenFileExplorer) {
        onOpenFileExplorer(path, reason);
      }
    };

    const handleFileEditor = (event: CustomEvent) => {
      const { filepath, reason } = event.detail;
      if (onOpenFileEditor) {
        onOpenFileEditor(filepath, reason);
      }
    };

    window.addEventListener('ai-open-file-explorer', handleFileExplorer as EventListener);
    window.addEventListener('ai-open-file-editor', handleFileEditor as EventListener);

    return () => {
      window.removeEventListener('ai-open-file-explorer', handleFileExplorer as EventListener);
      window.removeEventListener('ai-open-file-editor', handleFileEditor as EventListener);
    };
  }, [onOpenFileExplorer, onOpenFileEditor]);

  // Auto focus input
  useEffect(() => {
    if (isOpen && sessionId && inputRef.current && !isConfigModalOpen && !isCollapsed) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, sessionId, isConfigModalOpen, isCollapsed]);

  // Prevent event propagation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (e.ctrlKey && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      startNewConversation();
    }
  };

  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (sessionId && inputRef.current && e.target !== inputRef.current && !isConfigModalOpen && !isCollapsed) {
      inputRef.current.focus();
    }
  };

  // Handle message submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!inputValue.trim() || isLoading) return;
    
    if (!isConfigured) {
      setIsConfigModalOpen(true);
      return;
    }

    if (!sessionId) {
      const errorMessage: AIMessage = {
        id: Date.now().toString(),
        content: "❌ No active SSH session. Please connect to a server first.",
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    
    // Add user message
    const userMessage: AIMessage = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsThinking(true);
    setProgressUpdates([]);
    
    // Progress handler with enhanced tracking
    const handleProgress = (update: AIProgressUpdate) => {
      setProgressUpdates(prev => [...prev, update]);
      
      // Update thinking state
      if (update.type === 'thinking') {
        setIsThinking(true);
      } else if (update.type === 'executing' || update.type === 'completed') {
        setIsThinking(false);
      }
      
      // AI writing simulation for terminal commands
      if (update.type === 'executing' && update.toolCall?.function === 'execute_command') {
        const event = new CustomEvent('ai-writing', {
          detail: {
            type: 'ai_writing_start',
            sessionId: sessionId,
            command: update.toolCall.arguments?.command,
            description: update.toolCall.arguments?.description
          }
        });
        window.dispatchEvent(event);
        
        setTimeout(() => {
          const endEvent = new CustomEvent('ai-writing', {
            detail: {
              type: 'ai_writing_end',
              sessionId: sessionId
            }
          });
          window.dispatchEvent(endEvent);
        }, 8000);
      }
    };
    
    try {
      const aiResponse = await aiService.sendMessage(
        userMessage.content,
        sessionId,
        messages,
        handleProgress
      );
      
      setMessages(prev => [...prev, aiResponse]);
      setProgressUpdates([]);
      setIsLoading(false);
      setIsThinking(false);
      
      if (inputRef.current && !isConfigModalOpen) {
        inputRef.current.focus();
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      const errorMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        content: `❌ Error: ${error.message}`,
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      setProgressUpdates([]);
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  // Configuration handlers
  const handleConfigSaved = () => {
    setIsConfigured(true);
  };

  // New conversation
  const startNewConversation = () => {
    const hasUserMessages = messages.length > 1 || 
      (messages.length === 1 && messages[0].isUser);
    
    if (hasUserMessages) {
      const confirmed = window.confirm(
        'Are you sure you want to start a new conversation? All current messages will be lost.'
      );
      
      if (!confirmed) return;
    }
    
    setMessages([
      {
        id: '1',
        content: "Hello! I'm your AI assistant. I can help you navigate your server, execute commands, and analyze your system. What would you like to do today?",
        isUser: false,
        timestamp: new Date()
      }
    ]);
    setProgressUpdates([]);
    setIsThinking(false);
    
    if (inputRef.current && !isConfigModalOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // Get activity icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'thinking': return <RiBrainLine />;
      case 'executing': return <RiPlayLine />;
      case 'completed': return <RiCheckLine />;
      case 'error': return <RiErrorWarningLine />;
      default: return <RiPulseLine />;
    }
  };

  // Render activity updates
  const renderActivityUpdate = (update: AIProgressUpdate, index: number) => {
    const simplifyMessage = (message: string) => {
      let simplified = message
        .replace(/^[🧠🔧📊📈💻📖✏️📂✅❌🚨🤔✍️🎉📋]\s*/, '')
        .replace(/\n\`\`\`[\s\S]*?\`\`\`/g, '')
        .replace(/\n.*/, '');
      
      if (simplified.length > 80) {
        simplified = simplified.substring(0, 77) + '...';
      }
      
      return simplified;
    };

    const formatMessage = (message: string) => {
      const simplified = simplifyMessage(message);
      const parts = [];
      const inlineCodeRegex = /`([^`]+)`/g;
      let lastIndex = 0;
      let match;
      
      while ((match = inlineCodeRegex.exec(simplified)) !== null) {
        if (match.index > lastIndex) {
          parts.push(simplified.slice(lastIndex, match.index));
        }
        
        parts.push(<code key={match.index}>{match[1]}</code>);
        lastIndex = match.index + match[0].length;
      }
      
      if (lastIndex < simplified.length) {
        parts.push(simplified.slice(lastIndex));
      }
      
      return parts.length > 0 ? parts : [simplified];
    };

    return (
      <div key={index} className={`activity-item ${update.type}`}>
        <div className="activity-icon">
          {getActivityIcon(update.type)}
        </div>
        <div className="activity-text">
          {formatMessage(update.message)}
        </div>
        {update.step && (
          <div className="activity-step">
            #{update.step}
          </div>
        )}
      </div>
    );
  };

  // Toggle collapse
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Handle template selection
  const handleTemplateSelect = (prompt: string) => {
    setInputValue(prompt);
    setShowTemplatesModal(false);
    // Focus input after template selection
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div 
      className={`ai-assistant-panel ${isCollapsed ? 'collapsed' : ''} ${showTemplatesModal ? 'templates-open' : ''}`}
      onClick={handlePanelClick}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={handleKeyDown}
    >
      {/* Collapse button */}
      <button
        className="ai-collapse-btn"
        onClick={(e) => {
          e.stopPropagation();
          toggleCollapse();
        }}
        title={isCollapsed ? "Expand AI Panel" : "Collapse AI Panel"}
      >
        {isCollapsed ? <RiArrowLeftLine /> : <RiArrowRightLine />}
      </button>

      {/* Header */}
      <div className="ai-header">
        <div className="ai-title">
          <div className="title-left">
            <div className="ai-icon">
              <HiOutlineSparkles />
            </div>
            <div className="title-text">
              <h3>AI Assistant</h3>
              <p className="subtitle">Powered by AI • Ready to help</p>
            </div>
          </div>
          <div className="ai-controls">
            <button
              className="ai-control-btn templates"
              onClick={(e) => {
                e.stopPropagation();
                setShowTemplatesModal(true);
              }}
              title="Quick Start Templates"
            >
              <RiAppsLine />
            </button>
            <button
              className="ai-control-btn new-chat"
              onClick={(e) => {
                e.stopPropagation();
                startNewConversation();
              }}
              title="New Conversation"
            >
              <RiDeleteBin6Line />
            </button>
            <button
              className="ai-control-btn settings"
              onClick={(e) => {
                e.stopPropagation();
                setIsConfigModalOpen(true);
              }}
              title="Settings"
            >
              <RiSettings3Line />
            </button>
            <button
              className="ai-control-btn"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="Close"
            >
              <RiCloseLine />
            </button>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="ai-messages" onKeyDown={handleKeyDown}>
        {messages.map(message => (
          <div
            key={message.id}
            className={`ai-message ${message.isUser ? 'user' : 'assistant'}`}
          >
            <div className={`message-avatar ${isThinking && !message.isUser ? 'thinking' : ''}`}>
              {message.isUser ? (
                <FiUser />
              ) : (
                <FiCpu />
              )}
            </div>
            <div className={`message-bubble ${isThinking && !message.isUser ? 'thinking' : ''}`}>
              <p className="message-content">{message.content}</p>
              
              {/* Tool calls display */}
              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="tool-calls">
                  {message.toolCalls.map(toolCall => (
                    <div key={toolCall.id} className="tool-call">
                      <div className="tool-header">
                        <div className="tool-name">
                          <FiTool />
                          {toolCall.function}
                        </div>
                        <div className={`tool-status ${toolCall.status}`}>
                          {toolCall.status === 'success' && <FiCheck />}
                          {toolCall.status === 'error' && <FiAlertTriangle />}
                          {toolCall.status === 'pending' && <FiActivity />}
                          {toolCall.status}
                        </div>
                      </div>
                      {toolCall.result && (
                        <div className="tool-result">
                          <pre>{toolCall.result}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              <span className="message-time">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        
        {/* Loading state with AI activity */}
        {isLoading && (
          <div className="ai-message assistant">
            <div className={`message-avatar ${isThinking ? 'thinking' : ''}`}>
              <FiCpu />
            </div>
            <div className={`message-bubble ${isThinking ? 'thinking' : ''}`}>
              {progressUpdates.length > 0 ? (
                <div className="ai-activity">
                  <div className="activity-header">
                    <div className="activity-icon">
                      <FiActivity />
                    </div>
                    <span>AI Activity</span>
                  </div>
                  <div className="activity-list">
                    {progressUpdates.map((update, index) => renderActivityUpdate(update, index))}
                  </div>
                </div>
              ) : (
                <div className="typing-indicator">
                  <span className="typing-text">AI is thinking</span>
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="ai-input-area" onKeyDown={handleKeyDown}>
        <form className="input-form" onSubmit={handleSubmit}>
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything about your server..."
              disabled={!sessionId || isLoading}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button
            type="submit"
            className="send-btn"
            disabled={!inputValue.trim() || !sessionId || isLoading}
            title="Send Message"
          >
            <RiSendPlaneLine />
          </button>
        </form>
      </div>
      
      {/* Status bars */}
      {!sessionId && (
        <div className="ai-status-bar">
          <p className="status-text">Connect to a server to use the AI assistant</p>
        </div>
      )}
      
      {!isConfigured && (
        <div className="ai-status-bar warning">
          <p className="status-text">⚠ AI Assistant not configured</p>
          <button
            className="config-btn"
            onClick={() => setIsConfigModalOpen(true)}
          >
            Configure Now
          </button>
        </div>
      )}

      {/* Configuration modal */}
      <AIConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConfigSaved={handleConfigSaved}
      />
      
      {/* Templates modal */}
      <PromptTemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        onSelectTemplate={handleTemplateSelect}
      />
    </div>
  );
};

export default AIAssistantPanel; 