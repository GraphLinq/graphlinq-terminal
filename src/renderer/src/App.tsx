import React, { useState, useEffect, useRef } from 'react'
import ServerSidebar from './components/ServerSidebar'
import Terminal from './components/Terminal'
import TerminalOptionsModal from './components/TerminalOptionsModal'
import AIAssistantPanel from './components/AIAssistantPanel'
import AboutModal from './components/AboutModal'
import SSHKeyGeneratorModal from './components/SSHKeyGeneratorModal'
import FileExplorer from './components/FileExplorer'
import { Server } from './services/serverService'
import { sshService, SSHConnectionConfig } from './services/sshService'
import './styles/App.scss'

function App() {
  const [platform, setPlatform] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [connectedServer, setConnectedServer] = useState<Server | null>(null)
  const [sshSessionId, setSshSessionId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [isSSHKeyGenModalOpen, setIsSSHKeyGenModalOpen] = useState(false)
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false)

  // Get platform info
  useEffect(() => {
    const getPlatformInfo = async () => {
      if (window.electronAPI) {
        const platformInfo = await window.electronAPI.getPlatform()
        setPlatform(platformInfo)
      }
    }
    getPlatformInfo()
  }, [])

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Handle window controls
  const handleMinimize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.windowMinimize()
    }
  }

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.windowMaximize()
    }
  }

  const handleClose = async () => {
    // Disconnect SSH session before closing
    if (sshSessionId) {
      await sshService.disconnect(sshSessionId)
    }
    
    if (window.electronAPI) {
      await window.electronAPI.windowClose()
    }
  }

  // Handle sidebar toggle
  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen)
  }

  // Toggle menu
  const handleMenuToggle = () => {
    setMenuOpen(!menuOpen)
  }

  // Open DevTools
  const handleOpenDevTools = async () => {
    if (window.electronAPI?.openDevTools) {
      await window.electronAPI.openDevTools()
    }
    setMenuOpen(false)
  }

  // Open About dialog
  const handleOpenAbout = () => {
    setIsAboutModalOpen(true)
    setMenuOpen(false)
  }

  // Open SSH Key Generator
  const handleOpenSSHKeyGen = () => {
    setIsSSHKeyGenModalOpen(true)
    setMenuOpen(false)
  }

  // Open Terminal Options dialog
  const handleOpenTerminalOptions = () => {
    setIsOptionsModalOpen(true)
    setMenuOpen(false)
  }

  // Toggle AI Assistant
  const handleToggleAIAssistant = () => {
    setIsAIAssistantOpen(!isAIAssistantOpen)
  }

  // Toggle File Explorer
  const handleToggleFileExplorer = () => {
    setIsFileExplorerOpen(!isFileExplorerOpen)
  }

  // Handle AI requests to open file explorer
  const handleAIOpenFileExplorer = (path: string, reason: string) => {
    // Open file explorer if not already open
    setIsFileExplorerOpen(true)
    
    // Dispatch event to navigate to specific path
    const event = new CustomEvent('navigate-file-explorer', {
      detail: { path, reason }
    });
    window.dispatchEvent(event);
  }

  // Handle AI requests to open file editor
  const handleAIOpenFileEditor = (filepath: string, reason: string) => {
    // Open file explorer if not already open to ensure proper session context
    setIsFileExplorerOpen(true)
    
    // Dispatch event to open file in editor
    const event = new CustomEvent('open-file-in-editor', {
      detail: { filepath, reason }
    });
    window.dispatchEvent(event);
  }

  // Handle server connection from sidebar
  const handleServerConnect = async (server: Server) => {
    if (isConnecting) return
    
    setIsConnecting(true)
    
    try {
      const sshConfig: SSHConnectionConfig = {
        host: server.host,
        port: server.port,
        username: server.username,
        authType: server.authType as 'password' | 'privateKey',
        password: server.password,
        privateKeyPath: server.privateKeyPath
      }

      const result = await sshService.connect(sshConfig)
      
      if (result.success && result.sessionId) {
        setConnectedServer(server)
        setIsConnected(true)
        setSshSessionId(result.sessionId)
        
        // Close sidebar after connection
        setSidebarOpen(false)
        
        // Automatically open AI Assistant panel when connected
        setIsAIAssistantOpen(true)
      } else {
        console.error('Connection failed:', result.error)
      }
    } catch (error: any) {
      console.error('Connection error:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  // Handle disconnect
  const handleDisconnect = async () => {
    if (sshSessionId) {
      await sshService.disconnect(sshSessionId)
    }
    
    setIsConnected(false)
    setConnectedServer(null)
    setSshSessionId(null)
  }

  // Menu component
  const MenuComponent = () => (
    <div className="menu-container" ref={menuRef}>
      <button 
        className={`menu-toggle ${menuOpen ? 'active' : ''}`} 
        onClick={handleMenuToggle}
        title="Menu"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      
      {menuOpen && (
        <div className="menu-dropdown">
          <button onClick={() => {
            setIsOptionsModalOpen(true);
            setMenuOpen(false);
          }}>Terminal Options</button>
          <button onClick={handleOpenSSHKeyGen}>SSH Key Generator</button>
          <button onClick={() => {
            handleToggleAIAssistant();
            setMenuOpen(false);
          }}>AI Assistant</button>
          <button onClick={() => {
            handleToggleFileExplorer();
            setMenuOpen(false);
          }}>File Explorer</button>
          <button onClick={handleOpenDevTools}>DevTools</button>
          <button onClick={handleOpenAbout}>About</button>
        </div>
      )}
    </div>
  )

  return (
    <div className="terminal-app">
      <ServerSidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        onConnect={handleServerConnect}
        connectedServerId={connectedServer?.id}
      />
      
      <div className="terminal-header">
        {platform === 'darwin' ? (
          // macOS layout - controls on the left
          <>
            <div className="terminal-controls macos">
              <div className="control-button close" onClick={handleClose}></div>
              <div className="control-button minimize" onClick={handleMinimize}></div>
              <div className="control-button maximize" onClick={handleMaximize}></div>
            </div>
            <div className="terminal-header-left">
              <button 
                className={`sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
                onClick={handleSidebarToggle}
                title="Server Manager"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2 4h12v2H2V4zm0 4h12v2H2V8zm0 4h12v2H2v-2z"/>
                </svg>
                <span>Servers</span>
              </button>
              {isConnected && (
                <button 
                  className={`file-explorer-toggle ${isFileExplorerOpen ? 'open' : ''}`}
                  onClick={handleToggleFileExplorer}
                  title="File Explorer"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 4H7.621a.75.75 0 0 1-.53-.22L5.22 1.91A.75.75 0 0 0 4.69 1.5H1.5z"/>
                  </svg>
                  <span>Files</span>
                </button>
              )}
            </div>
            <div className="terminal-title">
              Graphlinq Terminal
            </div>
            <div className="terminal-header-right">
              <MenuComponent />
            </div>
          </>
        ) : (
          // Windows/Linux layout - controls on the right
          <>
            <div className="terminal-drag-area">
              <div className="terminal-header-left">
                <button 
                  className={`sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
                  onClick={handleSidebarToggle}
                  title="Server Manager"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M2 4h12v2H2V4zm0 4h12v2H2V8zm0 4h12v2H2v-2z"/>
                  </svg>
                  <span>Servers</span>
                </button>
                {isConnected && (
                  <button 
                    className={`file-explorer-toggle ${isFileExplorerOpen ? 'open' : ''}`}
                    onClick={handleToggleFileExplorer}
                    title="File Explorer"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 14.5 4H7.621a.75.75 0 0 1-.53-.22L5.22 1.91A.75.75 0 0 0 4.69 1.5H1.5z"/>
                    </svg>
                    <span>Files</span>
                  </button>
                )}
              </div>
              <div className="terminal-title">
                Graphlinq Terminal
              </div>
              <div className="terminal-header-right">
                <MenuComponent />
              </div>
            </div>
            <div className="terminal-controls windows">
              <div className="control-button minimize" onClick={handleMinimize}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M0,5 L10,5" stroke="currentColor" strokeWidth="1"/>
                </svg>
              </div>
              <div className="control-button maximize" onClick={handleMaximize}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1"/>
                </svg>
              </div>
              <div className="control-button close" onClick={handleClose}>
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" strokeWidth="1"/>
                </svg>
              </div>
            </div>
          </>
        )}
      </div>
      
      <div className="terminal-body">
        <Terminal
          sessionId={sshSessionId}
          isConnected={isConnected}
          onDisconnect={handleDisconnect}
        />
        
        {/* Panel Assistant IA */}
        <AIAssistantPanel
          isOpen={isAIAssistantOpen}
          onClose={() => setIsAIAssistantOpen(false)}
          sessionId={sshSessionId}
          onOpenFileExplorer={handleAIOpenFileExplorer}
          onOpenFileEditor={handleAIOpenFileEditor}
        />
        
        {/* Explorateur de fichiers */}
        <FileExplorer
          sessionId={sshSessionId}
          isConnected={isConnected}
          isOpen={isFileExplorerOpen}
          onToggle={handleToggleFileExplorer}
        />
      </div>

      {/* Footer avec informations de connexion */}
      <div className="terminal-footer">
        <div className="footer-left">
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-indicator"></div>
            <span className="status-text">
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="footer-center">
          {connectedServer && (
            <div className="footer-server-info">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 3h10v2H2V3zm0 3h10v2H2V6zm0 3h10v2H2V9z"/>
              </svg>
              <span className="server-name">{connectedServer.name}</span>
              <span className="server-host">({connectedServer.username}@{connectedServer.host}:{connectedServer.port})</span>
            </div>
          )}
        </div>
        
        <div className="footer-right">
          {isConnected && (
            <button 
              className="disconnect-button"
              onClick={handleDisconnect}
              title="Disconnect"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zM4.5 4.5L6 6l1.5-1.5L8 5l-1.5 1.5L8 8l-.5.5L6 7l-1.5 1.5L4 8l1.5-1.5L4 5l.5-.5z"/>
              </svg>
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Modal des options du terminal */}
      <TerminalOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
      />

      {/* Modal À propos */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      {/* Modal Générateur clés SSH */}
      <SSHKeyGeneratorModal
        isOpen={isSSHKeyGenModalOpen}
        onClose={() => setIsSSHKeyGenModalOpen(false)}
      />
    </div>
  )
}

export default App 