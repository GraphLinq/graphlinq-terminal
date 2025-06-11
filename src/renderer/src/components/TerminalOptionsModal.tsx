import React, { useEffect, useState } from 'react';
import './Terminal.scss';

// Type pour les options du terminal
export interface TerminalOptions {
  ai?: {
    openaiApiKey?: string;
    model?: string;
  };
}

// Déclaration des méthodes pour l'API Electron
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
  
  interface ElectronAPI {
    // Méthodes SSH
    sshWrite?: (sessionId: string, data: string) => Promise<void>;
    sshResize?: (sessionId: string, cols: number, rows: number) => Promise<void>;
    onSSHData?: (callback: (sessionId: string, data: string) => void) => void;
    offSSHData?: () => void;
    
    // Méthodes Clipboard
    clipboardWriteText?: (text: string) => Promise<void>;
    clipboardReadText?: () => Promise<string>;
    
    // Méthodes pour les options du terminal
    saveTerminalOptions?: (options: TerminalOptions) => Promise<void>;
    getTerminalOptions?: () => Promise<TerminalOptions>;
  }
}

// Props du composant modal pour les options du terminal
interface TerminalOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TerminalOptionsModal: React.FC<TerminalOptionsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<string>('ai');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4');
  
  // Gestionnaire pour fermer la modale et rendre le focus au terminal
  const handleClose = () => {
    onClose();
    // Donner le focus au terminal après la fermeture
    setTimeout(() => {
      const terminal = document.querySelector('.terminal-container');
      if (terminal && terminal instanceof HTMLElement) {
        terminal.focus();
      }
    }, 50);
  };

  // Empêcher la propagation des événements clavier à l'extérieur de la modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    
    // Gérer la touche Escape pour fermer la modal
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  // Gestionnaire spécifique pour coller (Ctrl+V) dans le champ de clé API
  const handleApiKeyPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // Le collage par défaut dans l'input HTML devrait fonctionner
  };

  const handleSave = () => {
    // Sauvegarder les options dans localStorage ou envoyer à l'API Electron
    const options: TerminalOptions = {
      ai: {
        openaiApiKey,
        model: selectedModel
      }
    };
    
    if (window.electronAPI?.saveTerminalOptions) {
      window.electronAPI.saveTerminalOptions(options);
    } else {
      localStorage.setItem('terminalOptions', JSON.stringify(options));
    }
    
    handleClose();
  };

  // Charger les options au montage
  useEffect(() => {
    const loadOptions = async () => {
      let options: TerminalOptions | undefined;
      
      if (window.electronAPI?.getTerminalOptions) {
        options = await window.electronAPI.getTerminalOptions();
      } else {
        const savedOptions = localStorage.getItem('terminalOptions');
        if (savedOptions) {
          options = JSON.parse(savedOptions);
        }
      }
      
      if (options?.ai) {
        setOpenaiApiKey(options.ai.openaiApiKey || '');
        setSelectedModel(options.ai.model || 'gpt-4');
      }
    };
    
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  // Forcer le focus sur la modal lorsqu'elle est ouverte
  useEffect(() => {
    if (isOpen) {
      // Sélectionner l'élément input pour le focus
      const apiKeyInput = document.getElementById('openai-api-key');
      if (apiKeyInput) {
        setTimeout(() => {
          apiKeyInput.focus();
        }, 100);
      }

      // Capturer la touche Escape au niveau document uniquement
      const handleDocumentKeyDown = (e: KeyboardEvent) => {
        // Gérer uniquement la touche Escape pour fermer la modal
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      // Utiliser un événement sans capture pour ne pas interférer avec le fonctionnement normal
      document.addEventListener('keydown', handleDocumentKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleDocumentKeyDown);
      };
    }
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="terminal-options-modal-overlay" 
      onKeyDown={handleKeyDown}
    >
      <div className="terminal-options-modal" onKeyDown={handleKeyDown}>
        <div className="terminal-options-modal-header">
          <h2>Options du terminal</h2>
          <button 
            className="terminal-options-modal-close" 
            onClick={handleClose}
            onKeyDown={handleKeyDown}
          >
            ×
          </button>
        </div>
        
        <div className="terminal-options-modal-tabs">
          <button 
            className={`terminal-options-tab ${activeTab === 'ai' ? 'active' : ''}`} 
            onClick={() => setActiveTab('ai')}
            onKeyDown={handleKeyDown}
          >
            Intelligence Artificielle
          </button>
          <button 
            className={`terminal-options-tab ${activeTab === 'appearance' ? 'active' : ''}`} 
            onClick={() => setActiveTab('appearance')}
            onKeyDown={handleKeyDown}
          >
            Apparence
          </button>
        </div>
        
        <div className="terminal-options-modal-content">
          {activeTab === 'ai' && (
            <div className="terminal-options-section">
              <h3>Configuration IA</h3>
              
              <div className="terminal-options-field">
                <label htmlFor="openai-api-key">Clé API OpenAI</label>
                <input
                  id="openai-api-key"
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  autoFocus
                  onKeyDown={handleKeyDown}
                  onPaste={handleApiKeyPaste}
                />
              </div>
              
              <div className="terminal-options-field">
                <label htmlFor="ai-model">Modèle</label>
                <select
                  id="ai-model"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  onKeyDown={handleKeyDown}
                >
                  <option value="o4-mini">o4-mini</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
            </div>
          )}
          
          {activeTab === 'appearance' && (
            <div className="terminal-options-section">
              <h3>Apparence</h3>
              <p>Options d'apparence à venir...</p>
            </div>
          )}
        </div>
        
        <div className="terminal-options-modal-footer">
          <button 
            className="terminal-options-cancel" 
            onClick={handleClose}
            onKeyDown={handleKeyDown}
          >
            Annuler
          </button>
          <button 
            className="terminal-options-save" 
            onClick={handleSave}
            onKeyDown={handleKeyDown}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminalOptionsModal; 