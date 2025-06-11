import React, { useState, useEffect, useRef } from 'react';
import { RiCloseLine, RiSave3Line } from 'react-icons/ri';
import { aiService } from '../services/aiService';
import './AIConfigModal.scss';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4');
  const [isConfigured, setIsConfigured] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const apiKeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if AI is already configured
    setIsConfigured(aiService.isConfigured());
    
    // Load saved settings from localStorage
    const savedApiKey = localStorage.getItem('openai_api_key');
    const savedModel = localStorage.getItem('openai_model');
    
    if (savedApiKey) {
      setApiKey(savedApiKey);
      // Automatically configure service if key exists
      aiService.configure({
        apiKey: savedApiKey,
        model: savedModel || 'gpt-4'
      });
      setIsConfigured(true);
    }
    
    if (savedModel) {
      setModel(savedModel);
    }
  }, [isOpen]);

  // Give focus to API Key field when modal opens
  useEffect(() => {
    if (isOpen && apiKeyRef.current) {
      setTimeout(() => {
        apiKeyRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      alert('Please enter a valid OpenAI API key');
      return;
    }

    setIsSaving(true);
    
    try {
      // Configure AI service
      aiService.configure({
        apiKey: apiKey.trim(),
        model: model
      });

      // Save to localStorage
      localStorage.setItem('openai_api_key', apiKey.trim());
      localStorage.setItem('openai_model', model);

      setIsConfigured(true);
      onConfigSaved();
      onClose();
    } catch (error: any) {
      console.error('Configuration error:', error);
      alert(`Configuration error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to delete the AI configuration?')) {
      localStorage.removeItem('openai_api_key');
      localStorage.removeItem('openai_model');
      setApiKey('');
      setModel('gpt-4');
      setIsConfigured(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ai-config-modal-overlay">
      <div className="ai-config-modal">
        <div className="ai-config-header">
          <h3>AI Assistant Configuration</h3>
          <button
            className="ai-config-close-button"
            onClick={onClose}
            title="Close"
          >
            <RiCloseLine />
          </button>
        </div>

        <div className="ai-config-content">
          <div className="ai-config-status">
            <div className={`status-badge ${isConfigured ? 'configured' : 'not-configured'}`}>
              {isConfigured ? '✓ Configured' : '⚠ Not configured'}
            </div>
          </div>

          <div className="ai-config-field">
            <label htmlFor="apiKey">OpenAI API Key</label>
            <input
              ref={apiKeyRef}
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="ai-config-input"
            />
            <small className="ai-config-help">
              Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com</a>
            </small>
          </div>

          <div className="ai-config-field">
            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="ai-config-select"
            >
              <option value="gpt-4-1106">GPT-4-1106</option>
              <option value="gpt-4o">GPT-4o (Recommended)</option>
              <option value="o4-mini">o4-mini</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
            <small className="ai-config-help">
              GPT-4 offers better performance for system administration tasks
            </small>
          </div>

          <div className="ai-config-info">
            <h4>AI Assistant Features</h4>
            <ul>
              <li>🔧 SSH command execution with visual feedback</li>
              <li>📁 Remote file reading and writing</li>
              <li>📋 Directory listing and navigation</li>
              <li>🤖 Intelligent assistance for system administration</li>
              <li>💬 Intuitive chat interface</li>
            </ul>
          </div>
        </div>

        <div className="ai-config-footer">
          {isConfigured && (
            <button
              className="ai-config-button secondary"
              onClick={handleReset}
            >
              Reset
            </button>
          )}
          <button
            className="ai-config-button primary"
            onClick={handleSave}
            disabled={isSaving || !apiKey.trim()}
          >
            <RiSave3Line />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIConfigModal;