import React, { useEffect, useState } from 'react';
import './TerminalOptionsModal.scss';

// Type pour les options du terminal
export interface TerminalOptions {
  appearance?: {
    theme?: {
      background?: string;
      foreground?: string;
      cursor?: string;
      selectionBackground?: string;
      black?: string;
      red?: string;
      green?: string;
      yellow?: string;
      blue?: string;
      magenta?: string;
      cyan?: string;
      white?: string;
    };
    font?: {
      family?: string;
      size?: number;
      weight?: string;
      lineHeight?: number;
    };
    cursor?: {
      style?: 'block' | 'underline' | 'bar';
      blink?: boolean;
    };
    scrollback?: number;
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
  onOptionsChange?: (options: TerminalOptions) => void;
}

const TerminalOptionsModal: React.FC<TerminalOptionsModalProps> = ({ isOpen, onClose, onOptionsChange }) => {
  const [activeTab, setActiveTab] = useState<string>('appearance');
  
  // Theme colors
  const [backgroundColor, setBackgroundColor] = useState<string>('#1a1a2e');
  const [foregroundColor, setForegroundColor] = useState<string>('#e0e7ff');
  const [cursorColor, setCursorColor] = useState<string>('#8b5cf6');
  const [selectionColor, setSelectionColor] = useState<string>('#6366f1');
  const [blackColor, setBlackColor] = useState<string>('#0f1419');
  const [redColor, setRedColor] = useState<string>('#ef4444');
  const [greenColor, setGreenColor] = useState<string>('#10b981');
  const [yellowColor, setYellowColor] = useState<string>('#f59e0b');
  const [blueColor, setBlueColor] = useState<string>('#3b82f6');
  const [magentaColor, setMagentaColor] = useState<string>('#8b5cf6');
  const [cyanColor, setCyanColor] = useState<string>('#06b6d4');
  const [whiteColor, setWhiteColor] = useState<string>('#e0e7ff');
  
  // Font settings
  const [fontFamily, setFontFamily] = useState<string>('Cascadia Code');
  const [fontSize, setFontSize] = useState<number>(14);
  const [fontWeight, setFontWeight] = useState<string>('normal');
  const [lineHeight, setLineHeight] = useState<number>(1.2);
  
  // Cursor settings
  const [cursorStyle, setCursorStyle] = useState<'block' | 'underline' | 'bar'>('block');
  const [cursorBlink, setCursorBlink] = useState<boolean>(true);
  
  // Other settings
  const [scrollback, setScrollback] = useState<number>(10000);
  
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

  const handleSave = () => {
    // Sauvegarder les options
    const options: TerminalOptions = {
      appearance: {
        theme: {
          background: backgroundColor,
          foreground: foregroundColor,
          cursor: cursorColor,
          selectionBackground: selectionColor,
          black: blackColor,
          red: redColor,
          green: greenColor,
          yellow: yellowColor,
          blue: blueColor,
          magenta: magentaColor,
          cyan: cyanColor,
          white: whiteColor,
        },
        font: {
          family: fontFamily,
          size: fontSize,
          weight: fontWeight,
          lineHeight: lineHeight,
        },
        cursor: {
          style: cursorStyle,
          blink: cursorBlink,
        },
        scrollback: scrollback,
      }
    };
    
    if (window.electronAPI?.saveTerminalOptions) {
      window.electronAPI.saveTerminalOptions(options);
    } else {
      localStorage.setItem('terminalOptions', JSON.stringify(options));
    }
    
    // Notify parent component of changes
    if (onOptionsChange) {
      onOptionsChange(options);
    }
    
    handleClose();
  };

  const handleReset = () => {
    // Reset to default values
    setBackgroundColor('#1a1a2e');
    setForegroundColor('#e0e7ff');
    setCursorColor('#8b5cf6');
    setSelectionColor('#6366f1');
    setBlackColor('#0f1419');
    setRedColor('#ef4444');
    setGreenColor('#10b981');
    setYellowColor('#f59e0b');
    setBlueColor('#3b82f6');
    setMagentaColor('#8b5cf6');
    setCyanColor('#06b6d4');
    setWhiteColor('#e0e7ff');
    setFontFamily('Cascadia Code');
    setFontSize(14);
    setFontWeight('normal');
    setLineHeight(1.2);
    setCursorStyle('block');
    setCursorBlink(true);
    setScrollback(10000);
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
      
      if (options?.appearance) {
        const { theme, font, cursor } = options.appearance;
        
        if (theme) {
          setBackgroundColor(theme.background || '#1a1a2e');
          setForegroundColor(theme.foreground || '#e0e7ff');
          setCursorColor(theme.cursor || '#8b5cf6');
          setSelectionColor(theme.selectionBackground || '#6366f1');
          setBlackColor(theme.black || '#0f1419');
          setRedColor(theme.red || '#ef4444');
          setGreenColor(theme.green || '#10b981');
          setYellowColor(theme.yellow || '#f59e0b');
          setBlueColor(theme.blue || '#3b82f6');
          setMagentaColor(theme.magenta || '#8b5cf6');
          setCyanColor(theme.cyan || '#06b6d4');
          setWhiteColor(theme.white || '#e0e7ff');
        }
        
        if (font) {
          setFontFamily(font.family || 'Cascadia Code');
          setFontSize(font.size || 14);
          setFontWeight(font.weight || 'normal');
          setLineHeight(font.lineHeight || 1.2);
        }
        
        if (cursor) {
          setCursorStyle(cursor.style || 'block');
          setCursorBlink(cursor.blink !== undefined ? cursor.blink : true);
        }
        
        setScrollback(options.appearance.scrollback || 10000);
      }
    };
    
    if (isOpen) {
      loadOptions();
    }
  }, [isOpen]);

  // Forcer le focus sur la modal lorsqu'elle est ouverte
  useEffect(() => {
    if (isOpen) {
      // Utiliser un événement sans capture pour ne pas interférer avec le fonctionnement normal
      const handleDocumentKeyDown = (e: KeyboardEvent) => {
        // Gérer uniquement la touche Escape pour fermer la modal
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      document.addEventListener('keydown', handleDocumentKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleDocumentKeyDown);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="terminal-options-modal-overlay" 
      onKeyDown={handleKeyDown}
    >
      <div className="terminal-options-modal" onKeyDown={handleKeyDown}>
        <div className="terminal-options-modal-header">
          <h2>Terminal Options</h2>
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
            className={`terminal-options-tab ${activeTab === 'appearance' ? 'active' : ''}`} 
            onClick={() => setActiveTab('appearance')}
            onKeyDown={handleKeyDown}
          >
            Appearance
          </button>
          <button 
            className={`terminal-options-tab ${activeTab === 'colors' ? 'active' : ''}`} 
            onClick={() => setActiveTab('colors')}
            onKeyDown={handleKeyDown}
          >
            Colors
          </button>
          <button 
            className={`terminal-options-tab ${activeTab === 'font' ? 'active' : ''}`} 
            onClick={() => setActiveTab('font')}
            onKeyDown={handleKeyDown}
          >
            Font
          </button>
        </div>
        
        <div className="terminal-options-modal-content">
          {activeTab === 'appearance' && (
            <div className="terminal-options-section">
              <h3>General Appearance</h3>
              
              <div className="terminal-options-field">
                <label htmlFor="cursor-style">Cursor Style</label>
                <select
                  id="cursor-style"
                  value={cursorStyle}
                  onChange={(e) => setCursorStyle(e.target.value as 'block' | 'underline' | 'bar')}
                  onKeyDown={handleKeyDown}
                >
                  <option value="block">Block</option>
                  <option value="underline">Underline</option>
                  <option value="bar">Bar</option>
                </select>
              </div>
              
              <div className="terminal-options-field">
                <label>
                  <input
                    type="checkbox"
                    checked={cursorBlink}
                    onChange={(e) => setCursorBlink(e.target.checked)}
                    onKeyDown={handleKeyDown}
                  />
                  Cursor Blink
                </label>
              </div>
              
              <div className="terminal-options-field">
                <label htmlFor="scrollback">Scrollback Lines</label>
                <input
                  id="scrollback"
                  type="number"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={scrollback}
                  onChange={(e) => setScrollback(parseInt(e.target.value))}
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
          )}
          
          {activeTab === 'colors' && (
            <div className="terminal-options-section">
              <h3>Color Theme</h3>
              
              <div className="color-grid">
                <div className="color-field">
                  <label htmlFor="bg-color">Background</label>
                  <div className="color-input-group">
                    <input
                      id="bg-color"
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#1a1a2e"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="fg-color">Foreground</label>
                  <div className="color-input-group">
                    <input
                      id="fg-color"
                      type="color"
                      value={foregroundColor}
                      onChange={(e) => setForegroundColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={foregroundColor}
                      onChange={(e) => setForegroundColor(e.target.value)}
                      placeholder="#e0e7ff"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="cursor-color">Cursor</label>
                  <div className="color-input-group">
                    <input
                      id="cursor-color"
                      type="color"
                      value={cursorColor}
                      onChange={(e) => setCursorColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={cursorColor}
                      onChange={(e) => setCursorColor(e.target.value)}
                      placeholder="#8b5cf6"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="selection-color">Selection</label>
                  <div className="color-input-group">
                    <input
                      id="selection-color"
                      type="color"
                      value={selectionColor}
                      onChange={(e) => setSelectionColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={selectionColor}
                      onChange={(e) => setSelectionColor(e.target.value)}
                      placeholder="#6366f1"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="black-color">Black</label>
                  <div className="color-input-group">
                    <input
                      id="black-color"
                      type="color"
                      value={blackColor}
                      onChange={(e) => setBlackColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={blackColor}
                      onChange={(e) => setBlackColor(e.target.value)}
                      placeholder="#0f1419"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="red-color">Red</label>
                  <div className="color-input-group">
                    <input
                      id="red-color"
                      type="color"
                      value={redColor}
                      onChange={(e) => setRedColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={redColor}
                      onChange={(e) => setRedColor(e.target.value)}
                      placeholder="#ef4444"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="green-color">Green</label>
                  <div className="color-input-group">
                    <input
                      id="green-color"
                      type="color"
                      value={greenColor}
                      onChange={(e) => setGreenColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={greenColor}
                      onChange={(e) => setGreenColor(e.target.value)}
                      placeholder="#10b981"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="yellow-color">Yellow</label>
                  <div className="color-input-group">
                    <input
                      id="yellow-color"
                      type="color"
                      value={yellowColor}
                      onChange={(e) => setYellowColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={yellowColor}
                      onChange={(e) => setYellowColor(e.target.value)}
                      placeholder="#f59e0b"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="blue-color">Blue</label>
                  <div className="color-input-group">
                    <input
                      id="blue-color"
                      type="color"
                      value={blueColor}
                      onChange={(e) => setBlueColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={blueColor}
                      onChange={(e) => setBlueColor(e.target.value)}
                      placeholder="#3b82f6"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="magenta-color">Magenta</label>
                  <div className="color-input-group">
                    <input
                      id="magenta-color"
                      type="color"
                      value={magentaColor}
                      onChange={(e) => setMagentaColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={magentaColor}
                      onChange={(e) => setMagentaColor(e.target.value)}
                      placeholder="#8b5cf6"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="cyan-color">Cyan</label>
                  <div className="color-input-group">
                    <input
                      id="cyan-color"
                      type="color"
                      value={cyanColor}
                      onChange={(e) => setCyanColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={cyanColor}
                      onChange={(e) => setCyanColor(e.target.value)}
                      placeholder="#06b6d4"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
                
                <div className="color-field">
                  <label htmlFor="white-color">White</label>
                  <div className="color-input-group">
                    <input
                      id="white-color"
                      type="color"
                      value={whiteColor}
                      onChange={(e) => setWhiteColor(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <input
                      type="text"
                      value={whiteColor}
                      onChange={(e) => setWhiteColor(e.target.value)}
                      placeholder="#e0e7ff"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'font' && (
            <div className="terminal-options-section">
              <h3>Font Settings</h3>
              
              <div className="terminal-options-field">
                <label htmlFor="font-family">Font Family</label>
                <select
                  id="font-family"
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  onKeyDown={handleKeyDown}
                >
                  <option value="Cascadia Code">Cascadia Code</option>
                  <option value="Fira Code">Fira Code</option>
                  <option value="JetBrains Mono">JetBrains Mono</option>
                  <option value="SF Mono">SF Mono</option>
                  <option value="Monaco">Monaco</option>
                  <option value="Menlo">Menlo</option>
                  <option value="Ubuntu Mono">Ubuntu Mono</option>
                  <option value="Consolas">Consolas</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>
              
              <div className="terminal-options-field">
                <label htmlFor="font-size">Font Size</label>
                <input
                  id="font-size"
                  type="range"
                  min="8"
                  max="24"
                  step="1"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  onKeyDown={handleKeyDown}
                />
                <span className="range-value">{fontSize}px</span>
              </div>
              
              <div className="terminal-options-field">
                <label htmlFor="font-weight">Font Weight</label>
                <select
                  id="font-weight"
                  value={fontWeight}
                  onChange={(e) => setFontWeight(e.target.value)}
                  onKeyDown={handleKeyDown}
                >
                  <option value="normal">Normal</option>
                  <option value="bold">Bold</option>
                  <option value="100">100 - Thin</option>
                  <option value="200">200 - Extra Light</option>
                  <option value="300">300 - Light</option>
                  <option value="400">400 - Normal</option>
                  <option value="500">500 - Medium</option>
                  <option value="600">600 - Semi Bold</option>
                  <option value="700">700 - Bold</option>
                  <option value="800">800 - Extra Bold</option>
                  <option value="900">900 - Black</option>
                </select>
              </div>
              
              <div className="terminal-options-field">
                <label htmlFor="line-height">Line Height</label>
                <input
                  id="line-height"
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.1"
                  value={lineHeight}
                  onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                  onKeyDown={handleKeyDown}
                />
                <span className="range-value">{lineHeight}</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="terminal-options-modal-footer">
          <button 
            className="terminal-options-reset" 
            onClick={handleReset}
            onKeyDown={handleKeyDown}
          >
            Reset to Default
          </button>
          <div className="footer-buttons">
            <button 
              className="terminal-options-cancel" 
              onClick={handleClose}
              onKeyDown={handleKeyDown}
            >
              Cancel
            </button>
            <button 
              className="terminal-options-save" 
              onClick={handleSave}
              onKeyDown={handleKeyDown}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalOptionsModal; 