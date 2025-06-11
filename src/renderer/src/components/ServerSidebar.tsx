import React, { useState, useEffect } from 'react'
import serverService, { Server } from '../services/serverService'
import './ServerSidebar.scss'

interface ServerSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onConnect: (server: Server) => void
  connectedServerId?: string
}

const ServerSidebar: React.FC<ServerSidebarProps> = ({ 
  isOpen, 
  onToggle, 
  onConnect, 
  connectedServerId 
}) => {
  const [servers, setServers] = useState<Server[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState(420)
  const [isResizing, setIsResizing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [newServer, setNewServer] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password' as 'password' | 'privateKey',
    password: '',
    privateKeyPath: '',
    description: '',
    category: 'default'
  })

  const categories = [
    { value: 'default', label: 'Default' },
    { value: 'production', label: 'Production' },
    { value: 'development', label: 'Development' },
    { value: 'staging', label: 'Staging' },
    { value: 'testing', label: 'Testing' }
  ]

  // Charger les serveurs au montage du composant
  useEffect(() => {
    loadServers()
  }, [])

  const loadServers = async () => {
    try {
      setLoading(true)
      const loadedServers = await serverService.loadServers()
      setServers(loadedServers)
      console.log('Servers loaded in component:', loadedServers)
    } catch (error) {
      console.error('Error loading servers in component:', error)
      setServers([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddServer = async () => {
    if (newServer.name && newServer.host && newServer.username) {
      try {
        const addedServer = await serverService.addServer(newServer)
        setServers(serverService.getAllServers())
        setNewServer({ 
          name: '', 
          host: '', 
          port: 22, 
          username: '', 
          authType: 'password',
          password: '',
          privateKeyPath: '',
          description: '',
          category: 'default'
        })
        setShowAddForm(false)
        console.log('Server added successfully:', addedServer)
      } catch (error) {
        console.error('Error adding server:', error)
      }
    }
  }

  const handleDeleteServer = async (id: string) => {
    try {
      const success = await serverService.deleteServer(id)
      if (success) {
        setServers(serverService.getAllServers())
        console.log('Server deleted successfully')
      }
    } catch (error) {
      console.error('Error deleting server:', error)
    }
    setShowDeleteConfirm(null)
  }

  const confirmDeleteServer = (id: string, serverName: string) => {
    setShowDeleteConfirm(id)
  }

  const handleConnect = (server: Server) => {
    // Update server status to connecting
    serverService.updateServerStatus(server.id, 'connecting')
    setServers([...serverService.getAllServers()])
    
    // Simulate connection
    setTimeout(() => {
      serverService.updateServerStatus(server.id, 'connected')
      // Disconnect all other servers
      servers.forEach(s => {
        if (s.id !== server.id) {
          serverService.updateServerStatus(s.id, 'disconnected')
        }
      })
      setServers([...serverService.getAllServers()])
      onConnect(server)
    }, 1000)
  }

  const handleDisconnect = (server: Server) => {
    serverService.updateServerStatus(server.id, 'disconnected')
    setServers([...serverService.getAllServers()])
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'production': return '#f44336'
      case 'development': return '#4caf50'
      case 'staging': return '#ff9800'
      case 'testing': return '#9c27b0'
      default: return '#2196f3'
    }
  }

  // Handle sidebar resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(320, Math.min(600, startWidth + (e.clientX - startX)))
      setSidebarWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    e.preventDefault()
  }

  // Empêcher la propagation des événements pour éviter les problèmes de focus
  const handleFormClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleInputFocus = (e: React.FocusEvent) => {
    e.stopPropagation()
  }

  if (loading) {
    return (
      <>
        <div className={`server-sidebar ${isOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>Serveurs SSH</h3>
          </div>
          <div className="loading-state">
            <p>Loading servers...</p>
          </div>
        </div>
        {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}
      </>
    )
  }

  return (
    <>
      {/* Sidebar */}
      <div 
        className={`server-sidebar ${isOpen ? 'open' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ 
          width: `${sidebarWidth}px`,
          '--sidebar-width': `${sidebarWidth}px`
        } as React.CSSProperties}
      >
        <div className="sidebar-header">
          <h3>SSH Servers</h3>
          <button 
            className="add-server-btn"
            onClick={() => setShowAddForm(true)}
            title="Add a server"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M7 0v14M0 7h14" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </button>
        </div>

        {/* Add Server Form */}
        {showAddForm && (
          <div className="add-server-form" onClick={handleFormClick}>
            <div className="form-section">
              <h4>General Information</h4>
              
              <div className="form-group">
                <label>Server Name</label>
                <input
                  type="text"
                  placeholder="My server"
                  value={newServer.name}
                  onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                  onFocus={handleInputFocus}
                  onClick={handleFormClick}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Host</label>
                  <input
                    type="text"
                    placeholder="hostname or IP"
                    value={newServer.host}
                    onChange={(e) => setNewServer(prev => ({ ...prev, host: e.target.value }))}
                    onFocus={handleInputFocus}
                    onClick={handleFormClick}
                  />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input
                    type="number"
                    placeholder="22"
                    value={newServer.port}
                    onChange={(e) => setNewServer(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                    onFocus={handleInputFocus}
                    onClick={handleFormClick}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="username"
                  value={newServer.username}
                  onChange={(e) => setNewServer(prev => ({ ...prev, username: e.target.value }))}
                  onFocus={handleInputFocus}
                  onClick={handleFormClick}
                />
              </div>
            </div>

            <div className="form-section">
              <h4>Authentication</h4>
              
              <div className="auth-tabs">
                <button 
                  className={`auth-tab ${newServer.authType === 'password' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setNewServer(prev => ({ ...prev, authType: 'password' }))
                  }}
                >
                  Password
                </button>
                <button 
                  className={`auth-tab ${newServer.authType === 'privateKey' ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setNewServer(prev => ({ ...prev, authType: 'privateKey' }))
                  }}
                >
                  Private Key
                </button>
              </div>

              {newServer.authType === 'password' ? (
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    placeholder="Password"
                    value={newServer.password}
                    onChange={(e) => setNewServer(prev => ({ ...prev, password: e.target.value }))}
                    onFocus={handleInputFocus}
                    onClick={handleFormClick}
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Private Key Path</label>
                  <input
                    type="text"
                    placeholder="~/.ssh/id_rsa"
                    value={newServer.privateKeyPath}
                    onChange={(e) => setNewServer(prev => ({ ...prev, privateKeyPath: e.target.value }))}
                    onFocus={handleInputFocus}
                    onClick={handleFormClick}
                  />
                </div>
              )}
            </div>

            <div className="form-section">
              <h4>Configuration</h4>
              
              <div className="form-group">
                <label>Category</label>
                <select 
                  value={newServer.category}
                  onChange={(e) => setNewServer(prev => ({ ...prev, category: e.target.value }))}
                  onFocus={handleInputFocus}
                  onClick={handleFormClick}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Server description..."
                  value={newServer.description}
                  onChange={(e) => setNewServer(prev => ({ ...prev, description: e.target.value }))}
                  onFocus={handleInputFocus}
                  onClick={handleFormClick}
                  rows={3}
                />
              </div>
            </div>

            <div className="form-actions">
              <button 
                className="btn-save" 
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddServer()
                }}
              >
                Save and Connect
              </button>
              <button 
                className="btn-secondary" 
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddServer()
                }}
              >
                Save
              </button>
              <button 
                className="btn-cancel" 
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAddForm(false)
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Server List */}
        <div className="server-list">
          {servers.map(server => (
            <div 
              key={server.id} 
              className={`server-item ${server.status} ${connectedServerId === server.id ? 'active' : ''}`}
            >
              <div className="server-content">
                <div className="server-info">
                  <div className="server-header">
                    <div className="server-name">{server.name}</div>
                    <div className="server-badges">
                      <div 
                        className="server-category"
                        style={{ backgroundColor: getCategoryColor(server.category) }}
                      >
                        {server.category}
                      </div>
                      <div className={`auth-badge ${server.authType}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                          {server.authType === 'password' ? (
                            <path d="M3 5V4c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v1h.5c.3 0 .5.2.5.5v4c0 .3-.2.5-.5.5h-5c-.3 0-.5-.2-.5-.5v-4c0-.3.2-.5.5-.5H3zm1-1v1h4V4c0-.6-.4-1-1-1H5c-.6 0-1 .4-1 1z"/>
                          ) : (
                            <path d="M1 3l10 3-10 3V7l6-2L1 5V3z"/>
                          )}
                        </svg>
                        {server.authType === 'password' ? 'PWD' : 'SSH'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="server-connection">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" className="connection-icon">
                      <path d="M3 3h8v2H9v2H5V5H3V3zM1 7h2v4h8V7h2v6H1V7z"/>
                    </svg>
                    <span className="connection-text">{server.username}@{server.host}</span>
                    <span className="port-badge">:{server.port}</span>
                  </div>
                  
                  {server.description && (
                    <div className="server-description">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="description-icon">
                        <path d="M6 0C2.7 0 0 2.7 0 6s2.7 6 6 6 6-2.7 6-6S9.3 0 6 0zM5 3h2v2H5V3zM5 7h2v2H5V7z"/>
                      </svg>
                      {server.description}
                    </div>
                  )}
                  
                  <div className="server-meta">
                    <div className="status-info">
                      <span className={`status-text ${server.status}`}>
                        {server.status === 'connected' ? 'Connected' : 
                         server.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
                      </span>
                    </div>
                    <div className="auth-info">
                      <span className="auth-label">Auth:</span>
                      <span className={`auth-type ${server.authType}`}>
                        {server.authType === 'password' ? 'Password' : 'Private Key'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="server-status">
                  <div className={`status-dot ${server.status}`}></div>
                </div>
              </div>

              <div className="server-actions">
                {server.status === 'disconnected' && (
                  <button 
                    className="btn-connect"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleConnect(server)
                    }}
                    title="Connect to server"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,16.5L6.5,12L11,7.5V10.5H16V13.5H11V16.5Z"/>
                    </svg>
                    <span>Connect</span>
                  </button>
                )}
                
                {server.status === 'connected' && (
                  <button 
                    className="btn-disconnect"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDisconnect(server)
                    }}
                    title="Disconnect from server"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M13,16.5L17.5,12L13,7.5V10.5H8V13.5H13V16.5Z"/>
                    </svg>
                    <span>Disconnect</span>
                  </button>
                )}

                {server.status === 'connecting' && (
                  <div className="connecting-status">
                    <div className="connecting-spinner">
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="12" strokeLinecap="round">
                          <animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="1s" repeatCount="indefinite"/>
                        </circle>
                      </svg>
                    </div>
                    <span>Connecting...</span>
                  </div>
                )}

                <button 
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    confirmDeleteServer(server.id, server.name)
                  }}
                  title="Delete this server"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z"/>
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {servers.length === 0 && !loading && (
          <div className="empty-state">
            <p>No servers configured</p>
            <button onClick={() => setShowAddForm(true)}>
              Add your first server
            </button>
          </div>
        )}

        {/* Resize Handle */}
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
          title="Resize sidebar"
        />
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="warning-icon">
                <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
              </svg>
              <h3>Confirm Deletion</h3>
            </div>
            <div className="modal-content">
              <p>
                Are you sure you want to delete the server{' '}
                <strong>{servers.find(s => s.id === showDeleteConfirm)?.name}</strong>?
              </p>
              <p className="warning-text">
                This action is irreversible. All connection information will be lost.
              </p>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-cancel-delete"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button 
                className="btn-confirm-delete"
                onClick={() => handleDeleteServer(showDeleteConfirm)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z"/>
                </svg>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}
    </>
  )
}

export default ServerSidebar 