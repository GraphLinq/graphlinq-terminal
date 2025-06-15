import React, { useState, useEffect, useMemo } from 'react'
import serverService, { Server } from '../services/serverService'
import './ServerSidebar.scss'

interface ServerSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onConnect: (server: Server) => void
  connectedServerId?: string
  onDisconnect?: (serverId: string) => void
}

type ViewMode = 'grid' | 'list'
type SortBy = 'name' | 'category' | 'host' | 'lastUsed'

const ServerSidebar: React.FC<ServerSidebarProps> = ({ 
  isOpen, 
  onToggle, 
  onConnect, 
  connectedServerId, 
  onDisconnect
}) => {
  const [servers, setServers] = useState<Server[]>([])
  const [filteredServers, setFilteredServers] = useState<Server[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(800)
  const [isResizing, setIsResizing] = useState(false)
  
  const [serverForm, setServerForm] = useState({
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password' as 'password' | 'privateKey',
    password: '',
    privateKeyPath: '',
    description: '',
    category: 'development'
  })

  const categories = [
    { value: 'all', label: 'All Servers', icon: '🌐', count: 0 },
    { value: 'production', label: 'Production', icon: '🔴', count: 0 },
    { value: 'development', label: 'Development', icon: '🟢', count: 0 },
    { value: 'staging', label: 'Staging', icon: '🟡', count: 0 },
    { value: 'testing', label: 'Testing', icon: '🟣', count: 0 },
    { value: 'database', label: 'Database', icon: '🗄️', count: 0 },
    { value: 'web', label: 'Web Servers', icon: '🌍', count: 0 },
    { value: 'api', label: 'API Servers', icon: '⚡', count: 0 },
    { value: 'monitoring', label: 'Monitoring', icon: '📊', count: 0 }
  ]

  // Load servers on component mount
  useEffect(() => {
    loadServers()
  }, [])

  // Update filtered servers when search, category, or servers change
  useEffect(() => {
    filterAndSortServers()
  }, [servers, searchQuery, selectedCategory, sortBy])

  // Sync server status when connectedServerId changes from outside
  useEffect(() => {
    if (servers.length > 0) {
      let hasChanges = false
      
      servers.forEach(server => {
        const shouldBeConnected = server.id === connectedServerId
        const currentlyConnected = server.status === 'connected'
        
        if (shouldBeConnected && !currentlyConnected) {
          serverService.updateServerStatus(server.id, 'connected')
          hasChanges = true
        } else if (!shouldBeConnected && currentlyConnected) {
          serverService.updateServerStatus(server.id, 'disconnected')
          hasChanges = true
        }
      })
      
      if (hasChanges) {
        setServers([...serverService.getAllServers()])
      }
    }
  }, [connectedServerId, servers])

  const loadServers = async () => {
    try {
      setLoading(true)
      const loadedServers = await serverService.loadServers()
      setServers(loadedServers)
    } catch (error) {
      console.error('Error loading servers:', error)
      setServers([])
    } finally {
      setLoading(false)
    }
  }

  const filterAndSortServers = () => {
    let filtered = [...servers]

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(server => 
        server.name.toLowerCase().includes(query) ||
        server.host.toLowerCase().includes(query) ||
        server.username.toLowerCase().includes(query) ||
        server.description?.toLowerCase().includes(query) ||
        server.category.toLowerCase().includes(query)
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(server => server.category === selectedCategory)
    }

    // Sort servers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'category':
          return a.category.localeCompare(b.category)
        case 'host':
          return a.host.localeCompare(b.host)
        case 'lastUsed':
          // For now, sort by status (connected first)
          if (a.status === 'connected' && b.status !== 'connected') return -1
          if (b.status === 'connected' && a.status !== 'connected') return 1
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    setFilteredServers(filtered)
  }

  const categoriesWithCounts = useMemo(() => {
    return categories.map(category => ({
      ...category,
      count: category.value === 'all' 
        ? servers.length 
        : servers.filter(s => s.category === category.value).length
    }))
  }, [servers])

  const resetForm = () => {
    setServerForm({
      name: '',
      host: '',
      port: 22,
      username: '',
      authType: 'password',
      password: '',
      privateKeyPath: '',
      description: '',
      category: 'development'
    })
  }

  const handleAddServer = async () => {
    if (serverForm.name && serverForm.host && serverForm.username) {
      try {
        await serverService.addServer(serverForm)
        await loadServers()
        resetForm()
        setShowAddForm(false)
      } catch (error) {
        console.error('Error adding server:', error)
      }
    }
  }

  const handleEditServer = (server: Server) => {
    setServerForm({
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      authType: server.authType,
      password: server.password || '',
      privateKeyPath: server.privateKeyPath || '',
      description: server.description || '',
      category: server.category
    })
    setEditingServer(server)
    setShowAddForm(true)
  }

  const handleUpdateServer = async () => {
    if (editingServer && serverForm.name && serverForm.host && serverForm.username) {
      try {
        await serverService.updateServer(editingServer.id, serverForm)
        await loadServers()
        resetForm()
        setEditingServer(null)
        setShowAddForm(false)
      } catch (error) {
        console.error('Error updating server:', error)
      }
    }
  }

  const handleDeleteServer = async (id: string) => {
    try {
      await serverService.deleteServer(id)
      await loadServers()
    } catch (error) {
      console.error('Error deleting server:', error)
    }
    setShowDeleteConfirm(null)
  }

  const handleConnect = (server: Server) => {
    serverService.updateServerStatus(server.id, 'connecting')
    setServers([...serverService.getAllServers()])
    
    setTimeout(() => {
      serverService.updateServerStatus(server.id, 'connected')
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
    if (onDisconnect) {
      onDisconnect(server.id)
    }
  }

  // Handle sidebar resizing
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = sidebarWidth

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(600, Math.min(1200, startWidth + (e.clientX - startX)))
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="6"/></svg>
      case 'connecting':
        return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="8" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" values="0 6 6;360 6 6" dur="1s" repeatCount="indefinite"/></circle></svg>
      default:
        return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><circle cx="6" cy="6" r="6" opacity="0.3"/></svg>
    }
  }

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.value === category)
    return cat?.icon || '📁'
  }

  if (!isOpen) return null

  return (
    <>
      <div 
        className={`server-manager ${isResizing ? 'resizing' : ''}`}
        style={{ 
          width: `${sidebarWidth}px`,
          '--sidebar-width': `${sidebarWidth}px`
        } as React.CSSProperties}
      >
        {/* Header */}
        <div className="manager-header">
          <div className="header-left">
            <button className="close-btn" onClick={onToggle} title="Close Server Manager">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M12.854 4.854a.5.5 0 0 0-.708-.708L8 8.293 3.854 4.146a.5.5 0 1 0-.708.708L7.293 9l-4.147 4.146a.5.5 0 0 0 .708.708L8 9.707l4.146 4.147a.5.5 0 0 0 .708-.708L8.707 9l4.147-4.146z"/>
              </svg>
            </button>
            <div className="header-title">
              <h1>Server Manager</h1>
              <span className="server-count">{servers.length} servers configured</span>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="view-controls">
              <button 
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                </svg>
              </button>
              <button 
                className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
                </svg>
              </button>
            </div>
            
            <button 
              className="add-server-btn primary"
              onClick={() => {
                resetForm()
                setEditingServer(null)
                setShowAddForm(true)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
              </svg>
              Add Server
            </button>
          </div>
        </div>

        <div className="manager-content">
          {/* Sidebar */}
          <div className="manager-sidebar">
            {/* Search */}
            <div className="search-section">
              <div className="search-input-wrapper">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="search-icon">
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search servers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button 
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                      <path d="M7 0C3.134 0 0 3.134 0 7s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zm3.5 9.5L9.5 10.5 7 8 4.5 10.5 3.5 9.5 6 7 3.5 4.5 4.5 3.5 7 6 9.5 3.5 10.5 4.5 8 7l2.5 2.5z"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Categories */}
            <div className="categories-section">
              <h3>Categories</h3>
              <div className="category-list">
                {categoriesWithCounts.map(category => (
                  <button
                    key={category.value}
                    className={`category-item ${selectedCategory === category.value ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category.value)}
                  >
                    <span className="category-icon">{category.icon}</span>
                    <span className="category-label">{category.label}</span>
                    <span className="category-count">{category.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Options */}
            <div className="sort-section">
              <h3>Sort By</h3>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="sort-select"
              >
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="host">Host</option>
                <option value="lastUsed">Last Used</option>
              </select>
            </div>
          </div>

          {/* Main Content */}
          <div className="manager-main">
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner">
                  <svg width="32" height="32" viewBox="0 0 32 32">
                    <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="18" strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="1s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                </div>
                <p>Loading servers...</p>
              </div>
            ) : filteredServers.length === 0 ? (
              <div className="empty-state">
                {searchQuery || selectedCategory !== 'all' ? (
                  <>
                    <div className="empty-icon">🔍</div>
                    <h3>No servers found</h3>
                    <p>Try adjusting your search or category filter</p>
                    <button 
                      className="clear-filters-btn"
                      onClick={() => {
                        setSearchQuery('')
                        setSelectedCategory('all')
                      }}
                    >
                      Clear Filters
                    </button>
                  </>
                ) : (
                  <>
                    <div className="empty-icon">🖥️</div>
                    <h3>No servers configured</h3>
                    <p>Add your first server to get started</p>
                    <button 
                      className="add-first-server-btn"
                      onClick={() => {
                        resetForm()
                        setEditingServer(null)
                        setShowAddForm(true)
                      }}
                    >
                      Add Server
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className={`servers-container ${viewMode}`}>
                {filteredServers.map(server => (
                  <div 
                    key={server.id} 
                    className={`server-card ${server.status} ${connectedServerId === server.id ? 'active' : ''}`}
                  >
                    <div className="server-card-header">
                      <div className="server-info">
                        <div className="server-name-row">
                          <h4 className="server-name">{server.name}</h4>
                          <div className="server-status">
                            {getStatusIcon(server.status)}
                            <span className={`status-text ${server.status}`}>
                              {server.status === 'connected' ? 'Connected' : 
                               server.status === 'connecting' ? 'Connecting...' : 'Disconnected'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="server-connection-info">
                          <span className="connection-string">
                            {server.username}@{server.host}:{server.port}
                          </span>
                          <div className="server-badges">
                            <span className="category-badge">
                              {getCategoryIcon(server.category)} {server.category}
                            </span>
                            <span className={`auth-badge ${server.authType}`}>
                              {server.authType === 'password' ? '🔑' : '🗝️'} 
                              {server.authType === 'password' ? 'Password' : 'SSH Key'}
                            </span>
                          </div>
                        </div>
                        
                        {server.description && (
                          <p className="server-description">{server.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="server-card-actions">
                      {server.status === 'disconnected' && (
                        <button 
                          className="action-btn connect"
                          onClick={() => handleConnect(server)}
                          title="Connect to server"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/>
                          </svg>
                          Connect
                        </button>
                      )}
                      
                      {server.status === 'connected' && (
                        <button 
                          className="action-btn disconnect"
                          onClick={() => handleDisconnect(server)}
                          title="Disconnect from server"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM11.5 7.5a.5.5 0 0 1 0 1H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5z"/>
                          </svg>
                          Disconnect
                        </button>
                      )}

                      {server.status === 'connecting' && (
                        <div className="connecting-indicator">
                          <svg width="16" height="16" viewBox="0 0 16 16">
                            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="12" strokeLinecap="round">
                              <animateTransform attributeName="transform" type="rotate" values="0 8 8;360 8 8" dur="1s" repeatCount="indefinite"/>
                            </circle>
                          </svg>
                          Connecting...
                        </div>
                      )}

                      <button 
                        className="action-btn edit"
                        onClick={() => handleEditServer(server)}
                        title="Edit server"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708L10.5 8.207l-3-3L12.146.146zM11.207 9l-3-3L2.5 11.707V14.5a.5.5 0 0 0 .5.5h2.793L11.207 9zM1 11.5a.5.5 0 0 1 .5-.5H2v-.5a.5.5 0 0 1 .5-.5H3v-.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5v-1z"/>
                        </svg>
                        Edit
                      </button>
                      
                      <button 
                        className="action-btn delete"
                        onClick={() => setShowDeleteConfirm(server.id)}
                        title="Delete server"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Resize Handle */}
        <div 
          className="resize-handle"
          onMouseDown={handleMouseDown}
          title="Resize panel"
        />
      </div>

      {/* Add/Edit Server Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="server-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingServer ? 'Edit Server' : 'Add New Server'}</h2>
              <button 
                className="close-modal-btn"
                onClick={() => setShowAddForm(false)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M12.854 4.854a.5.5 0 0 0-.708-.708L8 8.293 3.854 4.146a.5.5 0 1 0-.708.708L7.293 9l-4.147 4.146a.5.5 0 0 0 .708.708L8 9.707l4.146 4.147a.5.5 0 0 0 .708-.708L8.707 9l4.147-4.146z"/>
                </svg>
              </button>
            </div>

            <div className="modal-content">
              <div className="form-section">
                <h3>General Information</h3>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Server Name *</label>
                    <input
                      type="text"
                      placeholder="My Production Server"
                      value={serverForm.name}
                      onChange={(e) => setServerForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Category</label>
                    <select 
                      value={serverForm.category}
                      onChange={(e) => setServerForm(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {categories.slice(1).map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Host/IP Address *</label>
                    <input
                      type="text"
                      placeholder="192.168.1.100 or server.example.com"
                      value={serverForm.host}
                      onChange={(e) => setServerForm(prev => ({ ...prev, host: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Port</label>
                    <input
                      type="number"
                      placeholder="22"
                      value={serverForm.port}
                      onChange={(e) => setServerForm(prev => ({ ...prev, port: parseInt(e.target.value) || 22 }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      placeholder="root, ubuntu, admin..."
                      value={serverForm.username}
                      onChange={(e) => setServerForm(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="form-group full-width">
                  <label>Description</label>
                  <textarea
                    placeholder="Optional description for this server..."
                    value={serverForm.description}
                    onChange={(e) => setServerForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-section">
                <h3>Authentication</h3>
                <div className="auth-tabs">
                  <button 
                    className={`auth-tab ${serverForm.authType === 'password' ? 'active' : ''}`}
                    onClick={() => setServerForm(prev => ({ ...prev, authType: 'password' }))}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zM6 7v-.5A1.5 1.5 0 0 0 4.5 5h-1A1.5 1.5 0 0 0 2 6.5V7a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/>
                    </svg>
                    Password Authentication
                  </button>
                  <button 
                    className={`auth-tab ${serverForm.authType === 'privateKey' ? 'active' : ''}`}
                    onClick={() => setServerForm(prev => ({ ...prev, authType: 'privateKey' }))}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M0 8a4 4 0 0 1 7.465-2H14a.5.5 0 0 1 .354.146l1.5 1.5a.5.5 0 0 1 0 .708l-1.5 1.5a.5.5 0 0 1-.708 0L13 9.207l-.646.647a.5.5 0 0 1-.708 0L11 9.207l-.646.647a.5.5 0 0 1-.708 0L9 9.207l-.646.647A.5.5 0 0 1 8 10h-.535A4 4 0 0 1 0 8zm4-3a3 3 0 1 0 2.712 4.285A.5.5 0 0 1 7.163 9h.63l.853-.854a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.646-.647a.5.5 0 0 1 .708 0l.646.647.793-.793-1-1h-6.63a.5.5 0 0 1-.451-.285A3 3 0 0 0 4 5z"/>
                      <path d="M4 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                    </svg>
                    SSH Key Authentication
                  </button>
                </div>

                {serverForm.authType === 'password' ? (
                  <div className="form-group">
                    <label>Password *</label>
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={serverForm.password}
                      onChange={(e) => setServerForm(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Private Key Path *</label>
                    <input
                      type="text"
                      placeholder="~/.ssh/id_rsa or /path/to/private/key"
                      value={serverForm.privateKeyPath}
                      onChange={(e) => setServerForm(prev => ({ ...prev, privateKeyPath: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-save"
                onClick={editingServer ? handleUpdateServer : handleAddServer}
                disabled={!serverForm.name || !serverForm.host || !serverForm.username}
              >
                {editingServer ? 'Update Server' : 'Add Server'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="warning-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
                </svg>
              </div>
              <h3>Confirm Deletion</h3>
            </div>
            <div className="modal-content">
              <p>
                Are you sure you want to delete the server{' '}
                <strong>{servers.find(s => s.id === showDeleteConfirm)?.name}</strong>?
              </p>
              <p className="warning-text">
                This action cannot be undone. All connection information will be permanently lost.
              </p>
            </div>
            <div className="modal-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button 
                className="btn-delete"
                onClick={() => handleDeleteServer(showDeleteConfirm)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                  <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      <div className="sidebar-overlay" onClick={onToggle}></div>
    </>
  )
}

export default ServerSidebar 