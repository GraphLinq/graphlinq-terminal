import React, { useState, useEffect } from 'react'
import { pluginAPI } from '../../services/pluginAPI'
import { SidebarPanelConfig } from '../../types/plugin'
import './PluginPanels.scss'

interface PluginPanelsProps {
  isConnected: boolean
}

const PluginPanels: React.FC<PluginPanelsProps> = ({ isConnected }) => {
  const [panels, setPanels] = useState<Map<string, SidebarPanelConfig>>(new Map())
  const [activePanelId, setActivePanelId] = useState<string | null>(null)

  useEffect(() => {
    // Get initial panels
    const initialPanels = pluginAPI.getSidebarPanels()
    setPanels(new Map(initialPanels))

    // Listen for panel changes
    const eventEmitter = pluginAPI.getEventEmitter()
    
    const handlePanelAdded = (data: { pluginId: string; config: SidebarPanelConfig }) => {
      setPanels(prev => {
        const newPanels = new Map(prev)
        newPanels.set(data.config.id, data.config)
        return newPanels
      })
    }

    const handlePanelRemoved = (data: { pluginId: string; panelId: string }) => {
      setPanels(prev => {
        const newPanels = new Map(prev)
        newPanels.delete(data.panelId)
        return newPanels
      })
      
      // Close panel if it was active
      if (activePanelId === data.panelId) {
        setActivePanelId(null)
      }
    }

    eventEmitter.on('sidebar-panel-added', handlePanelAdded)
    eventEmitter.on('sidebar-panel-removed', handlePanelRemoved)

    return () => {
      eventEmitter.off('sidebar-panel-added', handlePanelAdded)
      eventEmitter.off('sidebar-panel-removed', handlePanelRemoved)
    }
  }, [activePanelId])

  const handlePanelToggle = (panelId: string) => {
    setActivePanelId(activePanelId === panelId ? null : panelId)
  }

  const panelArray = Array.from(panels.values())

  if (panelArray.length === 0) {
    return null
  }

  return (
    <div className="plugin-panels">
      {/* Discrete icon sidebar */}
      <div className="plugin-panel-sidebar">
        {panelArray.map(panel => (
          <button
            key={panel.id}
            className={`plugin-panel-icon ${activePanelId === panel.id ? 'active' : ''}`}
            onClick={() => handlePanelToggle(panel.id)}
            data-title={panel.title}
            title={panel.title}
          >
            {panel.icon || '🔌'}
          </button>
        ))}
      </div>

      {/* Expandable panel content */}
      <div className={`plugin-panel-content ${activePanelId ? 'open' : ''}`}>
        {activePanelId && (
          <>
            <div className="plugin-panel-header">
              <h3>{panels.get(activePanelId)?.title}</h3>
              <button
                className="panel-close-button"
                onClick={() => setActivePanelId(null)}
                title="Close panel"
              >
                ×
              </button>
            </div>
            <div className="plugin-panel-body">
              {(() => {
                const panel = panels.get(activePanelId)
                if (!panel) return null

                try {
                  // Render the plugin component
                  const Component = panel.component
                  return React.createElement(Component)
                } catch (error) {
                  console.error('Error rendering plugin panel:', error)
                  return (
                    <div className="plugin-panel-error">
                      <p>Error loading panel content</p>
                      <small>{error instanceof Error ? error.message : 'Unknown error'}</small>
                    </div>
                  )
                }
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PluginPanels 