// Simple EventEmitter implementation for browser compatibility
class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {}

  on(event: string, callback: Function): void {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event: string, callback: Function): void {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  once(event: string, callback: Function): void {
    const onceCallback = (...args: any[]) => {
      callback(...args)
      this.off(event, onceCallback)
    }
    this.on(event, onceCallback)
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return
    this.events[event].forEach(callback => {
      try {
        callback(...args)
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error)
      }
    })
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event]
    } else {
      this.events = {}
    }
  }
}

import { 
  PluginSDK, 
  TerminalAPI, 
  UIAPI, 
  FileSystemAPI, 
  EventAPI, 
  StorageAPI,
  PluginManifest,
  ExecuteOptions,
  CommandResult,
  SessionInfo,
  FileInfo,
  FileStats,
  FileEvent,
  SidebarPanelConfig,
  ContextMenuConfig,
  ToolbarButtonConfig,
  AppInfo
} from '../types/plugin'

export class PluginAPIService {
  private static instance: PluginAPIService
  private eventEmitter = new SimpleEventEmitter()
  private sidebarPanels = new Map<string, SidebarPanelConfig>()
  private contextMenuItems = new Map<string, ContextMenuConfig>()
  private toolbarButtons = new Map<string, ToolbarButtonConfig>()
  private fileWatchers = new Map<string, any>()
  private notificationCallback?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
  private modalCallback?: (component: React.ComponentType, props?: any) => Promise<any>
  private currentSession: SessionInfo | null = null

  static getInstance(): PluginAPIService {
    if (!PluginAPIService.instance) {
      PluginAPIService.instance = new PluginAPIService()
    }
    return PluginAPIService.instance
  }

  /**
   * Set callback functions for UI operations
   */
  setUICallbacks(callbacks: {
    showNotification?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void
    openModal?: (component: React.ComponentType, props?: any) => Promise<any>
  }) {
    this.notificationCallback = callbacks.showNotification
    this.modalCallback = callbacks.openModal
  }

  /**
   * Update current session info
   */
  setCurrentSession(session: SessionInfo | null) {
    this.currentSession = session
    this.eventEmitter.emit('session-change', session)
  }

  /**
   * Create SDK instance for a plugin
   */
  createSDK(manifest: PluginManifest): PluginSDK {
    const pluginId = manifest.name

    const terminal: TerminalAPI = {
      execute: async (command: string, options?: ExecuteOptions): Promise<CommandResult> => {
        if (!manifest.permissions.includes('terminal.execute')) {
          throw new Error('Plugin does not have terminal.execute permission')
        }

        try {
          if (!this.currentSession) {
            throw new Error('No active terminal session')
          }

          // Use the SSH write method to send the command
          if (!window.electronAPI?.sshWrite) {
            throw new Error('SSH API not available')
          }

          return new Promise((resolve, reject) => {
            let output = ''
            let errorOutput = ''
            let isComplete = false
            
            // Set up data listener to capture output
            const handleData = (sessionId: string, data: string) => {
              if (sessionId === this.currentSession?.id) {
                output += data
                
                // Check if command is complete (simple heuristic)
                if (data.includes('$') || data.includes('#') || data.includes('>')) {
                  if (!isComplete) {
                    isComplete = true
                    cleanup()
                    resolve({
                      stdout: output,
                      stderr: errorOutput,
                      exitCode: 0,
                      command
                    })
                  }
                }
              }
            }

            const cleanup = () => {
              if (window.electronAPI?.offSSHData) {
                window.electronAPI.offSSHData()
              }
            }

            // Set up timeout
            const timeout = setTimeout(() => {
              if (!isComplete) {
                isComplete = true
                cleanup()
                resolve({
                  stdout: output,
                  stderr: errorOutput,
                  exitCode: 0,
                  command
                })
              }
            }, options?.timeout || 10000)

            // Listen for SSH data
            if (window.electronAPI?.onSSHData) {
              window.electronAPI.onSSHData(handleData)
            }

            // Send the command
            const fullCommand = command + '\n'
            window.electronAPI.sshWrite(this.currentSession.id, fullCommand)
              .catch((error) => {
                cleanup()
                clearTimeout(timeout)
                reject(new Error(`Failed to send command: ${error.message}`))
              })
          })
        } catch (error) {
          throw new Error(`Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      executeStream: async (command: string, onData: (data: string) => void): Promise<void> => {
        if (!manifest.permissions.includes('terminal.execute')) {
          throw new Error('Plugin does not have terminal.execute permission')
        }

        if (!this.currentSession) {
          throw new Error('No active terminal session')
        }

        try {
          if (!window.electronAPI?.sshWrite || !window.electronAPI?.onSSHData) {
            throw new Error('SSH API not available')
          }

          return new Promise((resolve, reject) => {
            let isComplete = false
            
            const handleData = (sessionId: string, data: string) => {
              if (sessionId === this.currentSession?.id) {
                onData(data)
                
                // Check if command is complete
                if (data.includes('$') || data.includes('#') || data.includes('>')) {
                  if (!isComplete) {
                    isComplete = true
                    cleanup()
                    resolve()
                  }
                }
              }
            }

            const cleanup = () => {
              if (window.electronAPI?.offSSHData) {
                window.electronAPI.offSSHData()
              }
            }

            // Set up timeout
            const timeout = setTimeout(() => {
              if (!isComplete) {
                isComplete = true
                cleanup()
                resolve()
              }
            }, 30000) // 30 second timeout for streaming

            // Listen for SSH data
            window.electronAPI.onSSHData(handleData)

            // Send the command
            const fullCommand = command + '\n'
            window.electronAPI.sshWrite(this.currentSession.id, fullCommand)
              .catch((error) => {
                cleanup()
                clearTimeout(timeout)
                reject(new Error(`Failed to send command: ${error.message}`))
              })
          })
        } catch (error) {
          throw new Error(`Streaming execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      getCurrentSession: (): SessionInfo | null => {
        if (!manifest.permissions.includes('terminal.read')) {
          throw new Error('Plugin does not have terminal.read permission')
        }
        return this.currentSession
      },

      onOutput: (callback: (data: string) => void): void => {
        if (!manifest.permissions.includes('terminal.read')) {
          throw new Error('Plugin does not have terminal.read permission')
        }
        this.eventEmitter.on(`terminal-output-${pluginId}`, callback)
      },

      onError: (callback: (error: string) => void): void => {
        if (!manifest.permissions.includes('terminal.read')) {
          throw new Error('Plugin does not have terminal.read permission')
        }
        this.eventEmitter.on(`terminal-error-${pluginId}`, callback)
      },

      onSessionChange: (callback: (session: SessionInfo) => void): void => {
        if (!manifest.permissions.includes('terminal.read')) {
          throw new Error('Plugin does not have terminal.read permission')
        }
        this.eventEmitter.on('session-change', callback)
      }
    }

    const ui: UIAPI = {
      addSidebarPanel: (config: SidebarPanelConfig): string => {
        if (!manifest.permissions.includes('ui.sidebar')) {
          throw new Error('Plugin does not have ui.sidebar permission')
        }
        
        const panelId = `${pluginId}-${config.id}`
        this.sidebarPanels.set(panelId, { ...config, id: panelId })
        this.eventEmitter.emit('sidebar-panel-added', { pluginId, config: { ...config, id: panelId } })
        return panelId
      },

      removeSidebarPanel: (panelId: string): void => {
        if (!manifest.permissions.includes('ui.sidebar')) {
          throw new Error('Plugin does not have ui.sidebar permission')
        }
        
        const fullPanelId = panelId.startsWith(pluginId) ? panelId : `${pluginId}-${panelId}`
        this.sidebarPanels.delete(fullPanelId)
        this.eventEmitter.emit('sidebar-panel-removed', { pluginId, panelId: fullPanelId })
      },

      showNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error'): void => {
        if (!manifest.permissions.includes('ui.notification')) {
          throw new Error('Plugin does not have ui.notification permission')
        }
        
        if (this.notificationCallback) {
          this.notificationCallback(`[${manifest.displayName}] ${message}`, type)
        }
      },

      openModal: async (component: React.ComponentType, props?: any): Promise<any> => {
        if (!manifest.permissions.includes('ui.modal')) {
          throw new Error('Plugin does not have ui.modal permission')
        }
        
        if (this.modalCallback) {
          return await this.modalCallback(component, props)
        }
        throw new Error('Modal callback not available')
      },

      addContextMenuItem: (config: ContextMenuConfig): string => {
        const itemId = `${pluginId}-${config.id}`
        this.contextMenuItems.set(itemId, { ...config, id: itemId })
        this.eventEmitter.emit('context-menu-item-added', { pluginId, config: { ...config, id: itemId } })
        return itemId
      },

      addToolbarButton: (config: ToolbarButtonConfig): string => {
        const buttonId = `${pluginId}-${config.id}`
        this.toolbarButtons.set(buttonId, { ...config, id: buttonId })
        this.eventEmitter.emit('toolbar-button-added', { pluginId, config: { ...config, id: buttonId } })
        return buttonId
      }
    }

    const filesystem: FileSystemAPI = {
      readFile: async (path: string): Promise<string> => {
        if (!manifest.permissions.includes('filesystem.read')) {
          throw new Error('Plugin does not have filesystem.read permission')
        }
        
        try {
          return `File content from ${path}`
        } catch (error) {
          throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      writeFile: async (path: string, content: string): Promise<void> => {
        if (!manifest.permissions.includes('filesystem.write')) {
          throw new Error('Plugin does not have filesystem.write permission')
        }
        
        try {
          console.log(`Writing to ${path}: ${content.substring(0, 100)}...`)
        } catch (error) {
          throw new Error(`Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      listDirectory: async (path: string): Promise<FileInfo[]> => {
        if (!manifest.permissions.includes('filesystem.read')) {
          throw new Error('Plugin does not have filesystem.read permission')
        }
        
        try {
          return [
            {
              name: 'example.txt',
              path: `${path}/example.txt`,
              type: 'file',
              size: 1024,
              modified: new Date(),
              permissions: 'rw-r--r--'
            }
          ]
        } catch (error) {
          throw new Error(`Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      exists: async (path: string): Promise<boolean> => {
        if (!manifest.permissions.includes('filesystem.read')) {
          throw new Error('Plugin does not have filesystem.read permission')
        }
        
        try {
          return true
        } catch (error) {
          return false
        }
      },

      getStats: async (path: string): Promise<FileStats> => {
        if (!manifest.permissions.includes('filesystem.read')) {
          throw new Error('Plugin does not have filesystem.read permission')
        }
        
        try {
          return {
            size: 1024,
            isFile: true,
            isDirectory: false,
            modified: new Date(),
            created: new Date(),
            permissions: 'rw-r--r--'
          }
        } catch (error) {
          throw new Error(`Failed to get file stats: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      watchFile: (path: string, callback: (event: FileEvent) => void): string => {
        if (!manifest.permissions.includes('filesystem.read')) {
          throw new Error('Plugin does not have filesystem.read permission')
        }
        
        const watcherId = `${pluginId}-${Date.now()}`
        
        const watcher = {
          path,
          callback,
          close: () => {
            this.fileWatchers.delete(watcherId)
          }
        }
        
        this.fileWatchers.set(watcherId, watcher)
        return watcherId
      }
    }

    const events: EventAPI = {
      on: (event: string, callback: (...args: any[]) => void): void => {
        this.eventEmitter.on(`plugin-${pluginId}-${event}`, callback)
      },

      emit: (event: string, data?: any): void => {
        this.eventEmitter.emit(`plugin-${pluginId}-${event}`, data)
        this.eventEmitter.emit('plugin-event', { pluginId, event, data })
      },

      off: (event: string, callback: (...args: any[]) => void): void => {
        this.eventEmitter.off(`plugin-${pluginId}-${event}`, callback)
      },

      once: (event: string, callback: (...args: any[]) => void): void => {
        this.eventEmitter.once(`plugin-${pluginId}-${event}`, callback)
      }
    }

    const storage: StorageAPI = {
      get: async (key: string): Promise<any> => {
        if (!manifest.permissions.includes('storage.local')) {
          throw new Error('Plugin does not have storage.local permission')
        }
        
        try {
          const storageKey = `plugin-${pluginId}-${key}`
          const value = localStorage.getItem(storageKey)
          return value ? JSON.parse(value) : null
        } catch (error) {
          throw new Error(`Failed to get storage value: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      set: async (key: string, value: any): Promise<void> => {
        if (!manifest.permissions.includes('storage.local')) {
          throw new Error('Plugin does not have storage.local permission')
        }
        
        try {
          const storageKey = `plugin-${pluginId}-${key}`
          localStorage.setItem(storageKey, JSON.stringify(value))
        } catch (error) {
          throw new Error(`Failed to set storage value: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      remove: async (key: string): Promise<void> => {
        if (!manifest.permissions.includes('storage.local')) {
          throw new Error('Plugin does not have storage.local permission')
        }
        
        try {
          const storageKey = `plugin-${pluginId}-${key}`
          localStorage.removeItem(storageKey)
        } catch (error) {
          throw new Error(`Failed to remove storage value: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      clear: async (): Promise<void> => {
        if (!manifest.permissions.includes('storage.local')) {
          throw new Error('Plugin does not have storage.local permission')
        }
        
        try {
          const prefix = `plugin-${pluginId}-`
          const keysToRemove = []
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(prefix)) {
              keysToRemove.push(key)
            }
          }
          
          keysToRemove.forEach(key => localStorage.removeItem(key))
        } catch (error) {
          throw new Error(`Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      },

      keys: async (): Promise<string[]> => {
        if (!manifest.permissions.includes('storage.local')) {
          throw new Error('Plugin does not have storage.local permission')
        }
        
        try {
          const prefix = `plugin-${pluginId}-`
          const keys = []
          
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(prefix)) {
              keys.push(key.substring(prefix.length))
            }
          }
          
          return keys
        } catch (error) {
          throw new Error(`Failed to get storage keys: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    return {
      terminal,
      ui,
      filesystem,
      events,
      storage,
      getPluginInfo: () => manifest,
      getAppVersion: () => '1.0.0',
      getAppInfo: (): AppInfo => ({
        name: 'GraphLinq Terminal',
        version: '1.0.0',
        platform: navigator.platform,
        arch: 'x64'
      })
    }
  }

  /**
   * Get all registered sidebar panels
   */
  getSidebarPanels(): Map<string, SidebarPanelConfig> {
    return this.sidebarPanels
  }

  /**
   * Get all registered context menu items
   */
  getContextMenuItems(): Map<string, ContextMenuConfig> {
    return this.contextMenuItems
  }

  /**
   * Get all registered toolbar buttons
   */
  getToolbarButtons(): Map<string, ToolbarButtonConfig> {
    return this.toolbarButtons
  }

  /**
   * Clean up plugin resources
   */
  cleanupPlugin(pluginId: string) {
    // Remove sidebar panels
    for (const [id, panel] of this.sidebarPanels.entries()) {
      if (id.startsWith(pluginId)) {
        this.sidebarPanels.delete(id)
      }
    }

    // Remove context menu items
    for (const [id, item] of this.contextMenuItems.entries()) {
      if (id.startsWith(pluginId)) {
        this.contextMenuItems.delete(id)
      }
    }

    // Remove toolbar buttons
    for (const [id, button] of this.toolbarButtons.entries()) {
      if (id.startsWith(pluginId)) {
        this.toolbarButtons.delete(id)
      }
    }

    // Close file watchers
    for (const [id, watcher] of this.fileWatchers.entries()) {
      if (id.startsWith(pluginId)) {
        watcher.close()
        this.fileWatchers.delete(id)
      }
    }

    // Remove event listeners
    this.eventEmitter.removeAllListeners(`plugin-${pluginId}`)
    
    console.log(`Cleaned up resources for plugin: ${pluginId}`)
  }

  /**
   * Emit terminal output to plugins
   */
  emitTerminalOutput(data: string) {
    this.eventEmitter.emit('terminal-output', data)
  }

  /**
   * Emit terminal error to plugins
   */
  emitTerminalError(error: string) {
    this.eventEmitter.emit('terminal-error', error)
  }

  /**
   * Get event emitter for external use
   */
  getEventEmitter(): SimpleEventEmitter {
    return this.eventEmitter
  }
}

export const pluginAPI = PluginAPIService.getInstance() 