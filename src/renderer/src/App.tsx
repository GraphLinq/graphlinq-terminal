import React, { useState, useEffect, useRef } from 'react'
import ServerSidebar from './components/ServerSidebar'
import Terminal from './components/Terminal'
import TerminalOptionsModal from './components/TerminalOptionsModal'
import AIAssistantPanel from './components/AIAssistantPanel'
import AboutModal from './components/AboutModal'
import SSHKeyGeneratorModal from './components/SSHKeyGeneratorModal'
import FileExplorer from './components/FileExplorer'
import PluginManager from './components/PluginManager/PluginManager'
import PluginPanels from './components/PluginPanels/PluginPanels'
import NotificationSystem, { Notification } from './components/NotificationSystem'
import { Server } from './services/serverService'
import { sshService, SSHConnectionConfig } from './services/sshService'
import { pluginManager } from './services/pluginManager'
import { pluginAPI } from './services/pluginAPI'
import { 
  RiSettings3Line, 
  RiTerminalBoxLine, 
  RiRobotLine, 
  RiFolderOpenLine, 
  RiCodeLine, 
  RiInformationLine,
  RiMoreLine,
  RiPlugLine,
  RiCloseLine,
  RiAddLine
} from 'react-icons/ri'
import { 
  FaKey, 
  FaCog 
} from 'react-icons/fa'
import './styles/App.scss'

interface TerminalSession {
  id: string
  server: Server
  sessionId: string
  isConnected: boolean
  isConnecting: boolean
}

function App() {
  const [platform, setPlatform] = useState<string>('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const terminalHandlersRef = useRef<Map<string, (data: string) => void>>(new Map())
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false)
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false)
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false)
  const [isSSHKeyGenModalOpen, setIsSSHKeyGenModalOpen] = useState(false)
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false)
  const [isPluginManagerOpen, setIsPluginManagerOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Helper functions
  const getActiveSession = (): TerminalSession | null => {
    return terminalSessions.find(session => session.id === activeSessionId) || null
  }

  const isAnySessionConnected = (): boolean => {
    return terminalSessions.some(session => session.isConnected)
  }

  const getConnectedServerIds = (): string[] => {
    return terminalSessions
      .filter(session => session.isConnected)
      .map(session => session.server.id)
  }

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

  // Initialize plugin system
  useEffect(() => {
    const initializePlugins = async () => {
      try {
        await pluginManager.initialize()
        
        // Set up plugin API callbacks
        pluginAPI.setUICallbacks({
          showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
            addNotification(message, type)
          },
          openModal: async (component: React.ComponentType, props?: any) => {
            console.log('Plugin requested to open modal:', component, props)
            // Here you would integrate with your modal system
            return Promise.resolve()
          }
        })
        
        console.log('Plugin system initialized successfully')
        console.log('Loaded plugins:', pluginManager.getLoadedPlugins().map(p => p.manifest.displayName))
        
        // Show welcome notification
        addNotification('GraphLinq Terminal ready!', 'success')
      } catch (error) {
        console.error('Failed to initialize plugin system:', error)
      }
    }

    initializePlugins()
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

  // Close AI Assistant when no sessions are connected
  useEffect(() => {
    if (!isAnySessionConnected() && isAIAssistantOpen) {
      setIsAIAssistantOpen(false)
    }
  }, [terminalSessions, isAIAssistantOpen])

  // Update plugin API with active session
  useEffect(() => {
    const activeSession = getActiveSession()
    if (activeSession && activeSession.isConnected) {
      const sessionInfo = {
        id: activeSession.sessionId,
        host: activeSession.server.host,
        port: activeSession.server.port,
        username: activeSession.server.username,
        isConnected: true,
        currentDirectory: '~'
      }
      pluginAPI.setCurrentSession(sessionInfo)
    } else {
      pluginAPI.setCurrentSession(null)
    }
  }, [activeSessionId, terminalSessions])

  // Global SSH data handler setup
  useEffect(() => {
    const handleGlobalSSHData = (sessionId: string, data: string) => {
      const handler = terminalHandlersRef.current.get(sessionId)
      if (handler) {
        handler(data)
      }
    }

    // Set up global SSH data listener once
    if ((window as any).electronAPI?.onSSHData) {
      (window as any).electronAPI.onSSHData(handleGlobalSSHData)
    }

    return () => {
      // Clean up SSH listeners when app unmounts
      if ((window as any).electronAPI?.offSSHData) {
        (window as any).electronAPI.offSSHData()
      }
    }
  }, [])

  // Register/unregister terminal handlers
  const registerTerminalHandler = (sessionId: string, handler: (data: string) => void) => {
    terminalHandlersRef.current.set(sessionId, handler)
  }

  const unregisterTerminalHandler = (sessionId: string) => {
    terminalHandlersRef.current.delete(sessionId)
  }

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
    // Disconnect all SSH sessions before closing
    for (const session of terminalSessions) {
      if (session.isConnected) {
        await sshService.disconnect(session.sessionId)
      }
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

  // Notification system functions
  const addNotification = (message: string, type: 'info' | 'success' | 'warning' | 'error', duration?: number) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      type,
      duration: duration || (type === 'error' ? 8000 : 5000),
      timestamp: Date.now()
    }
    
    setNotifications(prev => [...prev, notification])
  }

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id))
  }

  // Terminal tab management
  const createTerminalSession = (server: Server, sessionId: string): TerminalSession => {
    return {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      server,
      sessionId,
      isConnected: true,
      isConnecting: false
    }
  }

  const addTerminalSession = (session: TerminalSession) => {
    setTerminalSessions(prev => [...prev, session])
    setActiveSessionId(session.id)
  }

  const removeTerminalSession = (sessionId: string) => {
    setTerminalSessions(prev => {
      const newSessions = prev.filter(session => session.id !== sessionId)
      
      // If we're removing the active session, switch to another one
      if (activeSessionId === sessionId) {
        const newActiveSession = newSessions[0]
        setActiveSessionId(newActiveSession?.id || null)
      }
      
      return newSessions
    })
  }

  const updateSessionStatus = (sessionId: string, isConnected: boolean, isConnecting: boolean = false) => {
    setTerminalSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, isConnected, isConnecting }
          : session
      )
    )
  }

  // Handle server connection from sidebar
  const handleServerConnect = async (server: Server) => {
    // Check if we're already connected to this server
    const existingSession = terminalSessions.find(session => 
      session.server.id === server.id && session.isConnected
    )
    
    if (existingSession) {
      // Just switch to existing session
      setActiveSessionId(existingSession.id)
      setSidebarOpen(false)
      addNotification(`Switched to existing connection: ${server.name}`, 'info')
      return
    }
    
    // Create new session
    const tempSessionId = `temp-${Date.now()}`
    const tempSession: TerminalSession = {
      id: tempSessionId,
      server,
      sessionId: '',
      isConnected: false,
      isConnecting: true
    }
    
    addTerminalSession(tempSession)
    
    try {
      const config: SSHConnectionConfig = {
        host: server.host,
        port: server.port,
        username: server.username,
        authType: server.authType,
        password: server.password,
        privateKeyPath: server.privateKeyPath
      }

      const result = await sshService.connect(config)
      
      if (!result.success) {
        throw new Error(result.error || 'Connection failed')
      }
      
      const sessionId = result.sessionId!
      
      // Update the session with real sessionId
      setTerminalSessions(prev => 
        prev.map(session => 
          session.id === tempSessionId 
            ? { ...session, sessionId, isConnected: true, isConnecting: false }
            : session
        )
      )
      
      // Show connection success notification
      addNotification(`Connected to ${server.name} (${server.host})`, 'success')
      
      // Close sidebar after connection
      setSidebarOpen(false)
      
      // Automatically open AI Assistant panel when first connection is made
      if (terminalSessions.length === 0) {
        setIsAIAssistantOpen(true)
      }

      // Notify plugins about server connection with a delay to ensure session is stable
      const sessionInfo = {
        id: sessionId,
        host: server.host,
        port: server.port,
        username: server.username,
        isConnected: true,
        currentDirectory: '~'
      }
      
      // Wait a bit for the SSH session to be fully established before notifying plugins
      setTimeout(async () => {
        await pluginManager.onServerConnect(sessionInfo)
        console.log('Plugins notified about server connection')
      }, 2000) // 2 second delay
      
      console.log(`Connected to ${server.name}`)
    } catch (error: any) {
      console.error('Connection failed:', error)
      addNotification(`Failed to connect to ${server.name}: ${error}`, 'error')
      
      // Remove the failed session
      removeTerminalSession(tempSessionId)
    }
  }

  // Handle disconnect from specific session
  const handleSessionDisconnect = async (sessionId: string) => {
    const session = terminalSessions.find(s => s.id === sessionId)
    if (!session) return
    
    try {
      if (session.isConnected && session.sessionId) {
        await sshService.disconnect(session.sessionId)
      }
      
      // Update server status in sidebar
      const { default: serverService } = await import('./services/serverService')
      serverService.updateServerStatus(session.server.id, 'disconnected')
      
      addNotification(`Disconnected from ${session.server.name}`, 'info')
      
      // Remove the session
      removeTerminalSession(sessionId)
      
      // If this was the last session, close AI Assistant
      if (terminalSessions.length === 1) {
        setIsAIAssistantOpen(false)
        await pluginManager.onServerDisconnect()
      }
      
    } catch (error) {
      console.error('Error disconnecting session:', error)
      addNotification(`Error disconnecting from ${session.server.name}`, 'error')
    }
  }

  // Handle disconnect all sessions
  const handleDisconnectAll = async () => {
    for (const session of terminalSessions) {
      if (session.isConnected && session.sessionId) {
        try {
          await sshService.disconnect(session.sessionId)
          
          // Update server status in sidebar
          const { default: serverService } = await import('./services/serverService')
          serverService.updateServerStatus(session.server.id, 'disconnected')
        } catch (error) {
          console.error('Error disconnecting session:', error)
        }
      }
    }
    
    setTerminalSessions([])
    setActiveSessionId(null)
    setIsAIAssistantOpen(false)
    
    await pluginManager.onServerDisconnect()
    addNotification('Disconnected from all servers', 'info')
  }

  // Terminal tabs component
  const TerminalTabs = () => {
    if (terminalSessions.length === 0) return null

    return (
      <div className="terminal-tabs">
        <div className="tabs-container">
          {terminalSessions.map(session => (
            <div 
              key={session.id}
              className={`terminal-tab ${activeSessionId === session.id ? 'active' : ''} ${session.isConnecting ? 'connecting' : 'disconnected'}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              <div className="tab-content">
                <div className={`tab-status ${session.isConnected ? 'connected' : session.isConnecting ? 'connecting' : 'disconnected'}`}>
                  {session.isConnecting ? (
                    <div className="connecting-spinner">
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="8" strokeLinecap="round">
                          <animateTransform attributeName="transform" type="rotate" values="0 6 6;360 6 6" dur="1s" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                    </div>
                  ) : (
                    <div className="status-dot"></div>
                  )}
                </div>
                <span className="tab-name">{session.server.name}</span>
                <span className="tab-host">({session.server.host})</span>
              </div>
              <button 
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSessionDisconnect(session.id)
                }}
                title="Disconnect"
              >
                <RiCloseLine size={14} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="tabs-actions">
          <button 
            className="add-tab-btn"
            onClick={() => setSidebarOpen(true)}
            title="Add new connection"
          >
            <RiAddLine size={16} />
          </button>
          
          {terminalSessions.length > 1 && (
            <button 
              className="disconnect-all-btn"
              onClick={handleDisconnectAll}
              title="Disconnect all"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2.5 1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1h-3zM3 4.5h2v1H3v-1z"/>
                <path d="M9.5 1a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1h-3zM10 4.5h2v1h-2v-1z"/>
                <path d="M2.5 9a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-3zM3 12.5h2v1H3v-1z"/>
                <path d="M9.5 9a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-3zM10 12.5h2v1h-2v-1z"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    )
  }

  // Menu component
  const MenuComponent = () => (
    <div className="menu-container" ref={menuRef}>
      <button 
        className={`menu-toggle ${menuOpen ? 'active' : ''}`} 
        onClick={handleMenuToggle}
        title="Menu"
      >
        <RiMoreLine size={16} />
      </button>
      
      {menuOpen && (
        <div className="menu-dropdown">
          <div className="menu-section">
            <div className="menu-section-title">Terminal</div>
            <button 
              className="menu-item"
              onClick={() => {
                setIsOptionsModalOpen(true);
                setMenuOpen(false);
              }}
            >
              <RiSettings3Line className="menu-icon" />
              <span className="menu-text">Terminal Options</span>
              <span className="menu-shortcut">Ctrl+,</span>
            </button>
          </div>
          
          <div className="menu-divider"></div>
          
          <div className="menu-section">
            <div className="menu-section-title">Tools</div>
            <button 
              className="menu-item"
              onClick={() => {
                setIsSSHKeyGenModalOpen(true);
                setMenuOpen(false);
              }}
            >
              <FaKey className="menu-icon" />
              <span className="menu-text">SSH Key Generator</span>
            </button>
            <button 
              className="menu-item"
              onClick={() => {
                handleToggleAIAssistant();
                setMenuOpen(false);
              }}
              disabled={!isAnySessionConnected()}
            >
              <RiRobotLine className="menu-icon" />
              <span className="menu-text">AI Assistant</span>
              <span className="menu-badge">AI</span>
            </button>
            <button 
              className="menu-item"
              onClick={() => {
                handleToggleFileExplorer();
                setMenuOpen(false);
              }}
              disabled={!isAnySessionConnected()}
            >
              <RiFolderOpenLine className="menu-icon" />
              <span className="menu-text">File Explorer</span>
            </button>
            <button 
              className="menu-item"
              onClick={() => {
                setIsPluginManagerOpen(true);
                setMenuOpen(false);
              }}
            >
              <RiPlugLine className="menu-icon" />
              <span className="menu-text">Plugin Manager</span>
            </button>
          </div>
          
          <div className="menu-divider"></div>
          
          <div className="menu-section">
            <div className="menu-section-title">Developer</div>
            <button 
              className="menu-item"
              onClick={handleOpenDevTools}
            >
              <RiCodeLine className="menu-icon" />
              <span className="menu-text">DevTools</span>
              <span className="menu-shortcut">F12</span>
            </button>
          </div>
          
          <div className="menu-divider"></div>
          
          <div className="menu-section">
            <button 
              className="menu-item"
              onClick={handleOpenAbout}
            >
              <RiInformationLine className="menu-icon" />
              <span className="menu-text">About</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const activeSession = getActiveSession()

  return (
    <div className="terminal-app">
      <ServerSidebar
        isOpen={sidebarOpen}
        onToggle={handleSidebarToggle}
        onConnect={handleServerConnect}
        connectedServerIds={getConnectedServerIds()}
        onDisconnect={() => {
          // This is called when disconnect is triggered from within the sidebar
          // We'll handle this in the sidebar component itself
        }}
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
              {isAnySessionConnected() && (
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
                {isAnySessionConnected() && (
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
      
      {/* Terminal Tabs */}
      <TerminalTabs />
      
      <div className="terminal-body">
        {/* Render all terminal instances, but only show the active one */}
        {terminalSessions.map(session => (
          <div
            key={session.id}
            className={`terminal-instance ${activeSessionId === session.id ? 'visible' : 'hidden'}`}
          >
            <Terminal
              sessionId={session.sessionId || session.id}
              isConnected={session.isConnected}
              onDisconnect={() => handleSessionDisconnect(session.id)}
              isVisible={activeSessionId === session.id}
              onRegisterHandler={registerTerminalHandler}
              onUnregisterHandler={unregisterTerminalHandler}
            />
          </div>
        ))}
        
        {/* Show welcome screen when no sessions */}
        {terminalSessions.length === 0 && (
          <div className="terminal-instance visible">
            <Terminal
              sessionId={null}
              isConnected={false}
              onDisconnect={() => {}}
              isVisible={true}
              onRegisterHandler={registerTerminalHandler}
              onUnregisterHandler={unregisterTerminalHandler}
            />
          </div>
        )}
        
        {/* Panel Assistant IA */}
        <AIAssistantPanel
          isOpen={isAIAssistantOpen}
          onClose={() => setIsAIAssistantOpen(false)}
          sessionId={activeSession?.sessionId || null}
          onOpenFileExplorer={handleAIOpenFileExplorer}
          onOpenFileEditor={handleAIOpenFileEditor}
        />
        
        {/* Explorateur de fichiers */}
        <FileExplorer
          sessionId={activeSession?.sessionId || null}
          isConnected={isAnySessionConnected()}
          isOpen={isFileExplorerOpen}
          onToggle={handleToggleFileExplorer}
        />

        {/* Plugin Panels */}
        <PluginPanels isConnected={isAnySessionConnected()} />
      </div>

      {/* Footer avec informations de connexion */}
      <div className="terminal-footer">
        <div className="footer-left">
          <div className={`connection-status ${isAnySessionConnected() ? 'connected' : 'disconnected'}`}>
            <div className="status-indicator"></div>
            <span className="status-text">
              {terminalSessions.some(s => s.isConnecting) ? 'Connecting...' : 
               isAnySessionConnected() ? `Connected (${terminalSessions.filter(s => s.isConnected).length})` : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="footer-center">
          {activeSession && (
            <div className="footer-server-info">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <path d="M2 3h10v2H2V3zm0 3h10v2H2V6zm0 3h10v2H2V9z"/>
              </svg>
              <span className="server-name">{activeSession.server.name}</span>
              <span className="server-host">({activeSession.server.username}@{activeSession.server.host}:{activeSession.server.port})</span>
            </div>
          )}
        </div>
        
        <div className="footer-right">
          {terminalSessions.length > 0 && (
            <button 
              className="disconnect-button"
              onClick={terminalSessions.length === 1 ? 
                () => handleSessionDisconnect(terminalSessions[0].id) : 
                handleDisconnectAll
              }
              title={terminalSessions.length === 1 ? "Disconnect" : "Disconnect All"}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zM4.5 4.5L6 6l1.5-1.5L8 5l-1.5 1.5L8 8l-.5.5L6 7l-1.5 1.5L4 8l1.5-1.5L4 5l.5-.5z"/>
              </svg>
              {terminalSessions.length === 1 ? 'Disconnect' : 'Disconnect All'}
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

      <PluginManager
        isOpen={isPluginManagerOpen}
        onClose={() => setIsPluginManagerOpen(false)}
      />

      {/* Notification System */}
      <NotificationSystem
        notifications={notifications}
        onRemoveNotification={removeNotification}
      />
    </div>
  )
}

export default App 