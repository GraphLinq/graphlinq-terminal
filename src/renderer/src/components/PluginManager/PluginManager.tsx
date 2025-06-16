import React, { useState, useEffect, useCallback } from 'react'
import { 
  RiSearchLine, 
  RiGridLine, 
  RiListCheck, 
  RiDownloadLine,
  RiRefreshLine,
  RiCloseLine,
  RiPlugLine
} from 'react-icons/ri'
import { LoadedPlugin, PluginInstallProgress } from '../../types/plugin'
import { pluginManager } from '../../services/pluginManager'
import './PluginManager.scss'

interface PluginManagerProps {
  isOpen: boolean
  onClose: () => void
}

type ViewMode = 'grid' | 'list'
type FilterCategory = 'all' | 'enabled' | 'disabled' | 'error'
type SortBy = 'name' | 'category' | 'date' | 'status'

const PluginManager: React.FC<PluginManagerProps> = ({ isOpen, onClose }) => {
  const [plugins, setPlugins] = useState<LoadedPlugin[]>([])
  const [filteredPlugins, setFilteredPlugins] = useState<LoadedPlugin[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [selectedPlugin, setSelectedPlugin] = useState<LoadedPlugin | null>(null)
  const [showInstaller, setShowInstaller] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [installProgress, setInstallProgress] = useState<PluginInstallProgress | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadPlugins()
    }
  }, [isOpen])

  useEffect(() => {
    filterAndSortPlugins()
  }, [plugins, searchQuery, filterCategory, sortBy])

  const loadPlugins = useCallback(async () => {
    try {
      setIsLoading(true)
      await pluginManager.initialize()
      const loadedPlugins = pluginManager.getLoadedPlugins()
      setPlugins(loadedPlugins)
    } catch (error) {
      console.error('Failed to load plugins:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const filterAndSortPlugins = useCallback(() => {
    let filtered = [...plugins]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(plugin => 
        plugin.manifest.displayName.toLowerCase().includes(query) ||
        plugin.manifest.name.toLowerCase().includes(query) ||
        plugin.manifest.description.toLowerCase().includes(query) ||
        plugin.manifest.category.toLowerCase().includes(query) ||
        (plugin.manifest.keywords || []).some(keyword => 
          keyword.toLowerCase().includes(query)
        )
      )
    }

    switch (filterCategory) {
      case 'enabled':
        filtered = filtered.filter(plugin => plugin.enabled)
        break
      case 'disabled':
        filtered = filtered.filter(plugin => !plugin.enabled)
        break
      case 'error':
        filtered = filtered.filter(plugin => plugin.error)
        break
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.manifest.displayName.localeCompare(b.manifest.displayName)
        case 'category':
          return a.manifest.category.localeCompare(b.manifest.category)
        case 'date':
          return b.loadedAt.getTime() - a.loadedAt.getTime()
        case 'status':
          if (a.enabled !== b.enabled) {
            return a.enabled ? -1 : 1
          }
          return a.manifest.displayName.localeCompare(b.manifest.displayName)
        default:
          return 0
      }
    })

    setFilteredPlugins(filtered)
  }, [plugins, searchQuery, filterCategory, sortBy])

  const handlePluginToggle = async (pluginId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await pluginManager.enablePlugin(pluginId)
      } else {
        await pluginManager.disablePlugin(pluginId)
      }
      await loadPlugins()
    } catch (error) {
      console.error(`Failed to ${enabled ? 'enable' : 'disable'} plugin:`, error)
    }
  }

  const handlePluginUninstall = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) {
      return
    }

    try {
      await pluginManager.uninstallPlugin(pluginId)
      await loadPlugins()
      if (selectedPlugin?.id === pluginId) {
        setSelectedPlugin(null)
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error)
    }
  }

  const getPluginStats = () => {
    return {
      total: plugins.length,
      enabled: plugins.filter(p => p.enabled).length,
      disabled: plugins.filter(p => !p.enabled).length,
      withErrors: plugins.filter(p => p.error).length
    }
  }

  const stats = getPluginStats()

  if (!isOpen) return null

  return (
    <div className="plugin-manager-overlay">
      <div className="plugin-manager">
        <div className="plugin-manager__header">
          <div className="plugin-manager__title">
            <RiPlugLine className="plugin-manager__icon" />
            <h2>Plugin Manager</h2>
          </div>
          
          <div className="plugin-manager__stats">
            <div className="stat">
              <span className="stat__value">{stats.total}</span>
              <span className="stat__label">Total</span>
            </div>
            <div className="stat stat--success">
              <span className="stat__value">{stats.enabled}</span>
              <span className="stat__label">Enabled</span>
            </div>
            <div className="stat stat--muted">
              <span className="stat__value">{stats.disabled}</span>
              <span className="stat__label">Disabled</span>
            </div>
            {stats.withErrors > 0 && (
              <div className="stat stat--error">
                <span className="stat__value">{stats.withErrors}</span>
                <span className="stat__label">Errors</span>
              </div>
            )}
          </div>
          
          <button className="plugin-manager__close" onClick={onClose}>
            <RiCloseLine />
          </button>
        </div>

        <div className="plugin-manager__toolbar">
          <div className="plugin-manager__search">
            <RiSearchLine className="search-icon" />
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="plugin-manager__filters">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
              className="filter-select"
            >
              <option value="all">All Plugins</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
              <option value="error">With Errors</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="sort-select"
            >
              <option value="name">Sort by Name</option>
              <option value="category">Sort by Category</option>
              <option value="date">Sort by Date</option>
              <option value="status">Sort by Status</option>
            </select>
          </div>

          <div className="plugin-manager__view-controls">
            <button
              className={`view-button ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <RiGridLine />
            </button>
            <button
              className={`view-button ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <RiListCheck />
            </button>
          </div>

          <div className="plugin-manager__actions">
            <button
              className="action-button"
              onClick={() => setShowInstaller(true)}
              title="Install Plugin"
            >
              <RiDownloadLine />
              Install
            </button>
            <button
              className="action-button"
              onClick={loadPlugins}
              disabled={isLoading}
              title="Refresh"
            >
              <RiRefreshLine className={isLoading ? 'spinning' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <div className="plugin-manager__content">
          <div className="plugin-manager__main">
            {isLoading ? (
              <div className="plugin-manager__loading">
                <RiRefreshLine className="spinning" />
                <span>Loading plugins...</span>
              </div>
            ) : filteredPlugins.length === 0 ? (
              <div className="plugin-manager__empty">
                <RiPlugLine className="empty-icon" />
                <h3>No plugins found</h3>
                <p>
                  {searchQuery || filterCategory !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Install your first plugin to get started'
                  }
                </p>
                {!searchQuery && filterCategory === 'all' && (
                  <button
                    className="empty-action"
                    onClick={() => setShowInstaller(true)}
                  >
                    <RiDownloadLine />
                    Install Plugin
                  </button>
                )}
              </div>
            ) : (
              <div className={`plugin-list plugin-list--${viewMode}`}>
                {filteredPlugins.map(plugin => (
                  <div key={plugin.id} className="plugin-card">
                    <div className="plugin-card__header">
                      <h3>{plugin.manifest.displayName}</h3>
                      <span className="plugin-card__version">v{plugin.manifest.version}</span>
                    </div>
                    <p className="plugin-card__description">{plugin.manifest.description}</p>
                    <div className="plugin-card__meta">
                      <span className="plugin-card__category">{plugin.manifest.category}</span>
                      <span className="plugin-card__author">by {plugin.manifest.author}</span>
                    </div>
                    <div className="plugin-card__actions">
                      <button
                        className={`toggle-button ${plugin.enabled ? 'enabled' : 'disabled'}`}
                        onClick={() => handlePluginToggle(plugin.id, !plugin.enabled)}
                      >
                        {plugin.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        className="uninstall-button"
                        onClick={() => handlePluginUninstall(plugin.id)}
                      >
                        Uninstall
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showInstaller && (
          <div className="plugin-installer-overlay">
            <div className="plugin-installer">
              <div className="plugin-installer__header">
                <h3>Install Plugin</h3>
                <button onClick={() => setShowInstaller(false)}>
                  <RiCloseLine />
                </button>
              </div>
              <div className="plugin-installer__content">
                <p>Plugin installation will be implemented in the next phase.</p>
                <button onClick={() => setShowInstaller(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PluginManager 