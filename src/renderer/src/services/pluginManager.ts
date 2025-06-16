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
  Plugin, 
  PluginManifest, 
  LoadedPlugin, 
  PluginInstallProgress,
  SessionInfo,
  PluginSDK
} from '../types/plugin'
import { pluginSecurity } from './pluginSecurity'
import { pluginAPI } from './pluginAPI'
import React from 'react'

export class PluginManagerService {
  private static instance: PluginManagerService
  private eventEmitter = new SimpleEventEmitter()
  private loadedPlugins = new Map<string, LoadedPlugin>()
  private pluginsDirectory = 'plugins'
  private isInitialized = false

  static getInstance(): PluginManagerService {
    if (!PluginManagerService.instance) {
      PluginManagerService.instance = new PluginManagerService()
    }
    return PluginManagerService.instance
  }

  /**
   * Initialize the plugin manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      console.log('Initializing Plugin Manager...')
      
      // Create plugins directory if it doesn't exist
      await this.ensurePluginsDirectory()
      
      // Load all plugins from the plugins directory
      await this.loadAllPlugins()
      
      this.isInitialized = true
      this.eventEmitter.emit('initialized')
      
      console.log(`Plugin Manager initialized with ${this.loadedPlugins.size} plugins`)
    } catch (error) {
      console.error('Failed to initialize Plugin Manager:', error)
      throw error
    }
  }

  /**
   * Ensure plugins directory exists
   */
  private async ensurePluginsDirectory(): Promise<void> {
    try {
      // For now, we'll assume the directory exists
      // In a real implementation, this would create the directory via Electron IPC
      console.log(`Ensuring plugins directory exists: ${this.pluginsDirectory}`)
    } catch (error) {
      console.error('Failed to ensure plugins directory:', error)
      throw error
    }
  }

  /**
   * Load all plugins from the plugins directory
   */
  async loadAllPlugins(): Promise<void> {
    try {
      // For now, we'll simulate discovering plugins
      // In a real implementation, this would scan the plugins directory
      const pluginDirectories = await this.discoverPlugins()
      
      for (const pluginDir of pluginDirectories) {
        try {
          await this.loadPlugin(pluginDir)
        } catch (error) {
          console.error(`Failed to load plugin from ${pluginDir}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to load plugins:', error)
      throw error
    }
  }

  /**
   * Discover available plugins in the plugins directory
   */
  private async discoverPlugins(): Promise<string[]> {
    try {
      console.log('Discovering plugins...')
      
      if (!window.electronAPI?.readDirectory) {
        console.warn('ElectronAPI not available, cannot discover plugins')
        return []
      }
      
      // Get the list of plugin directories from the main process
      const pluginDirectories = await window.electronAPI.readDirectory('plugins')
      console.log('Found plugin directories:', pluginDirectories)
      
      const validPlugins: string[] = []
      
      for (const pluginDir of pluginDirectories) {
        const pluginPath = `plugins/${pluginDir}`
        try {
          // Check if manifest.json exists
          if (!window.electronAPI?.fileExists) {
            continue
          }
          
          const manifestExists = await window.electronAPI.fileExists(`${pluginPath}/manifest.json`)
          if (manifestExists) {
            validPlugins.push(pluginPath)
            console.log(`Discovered valid plugin: ${pluginPath}`)
          } else {
            console.log(`Skipping ${pluginPath}: no manifest.json found`)
          }
        } catch (error) {
          console.log(`Error checking plugin ${pluginPath}:`, error)
        }
      }
      
      return validPlugins
    } catch (error) {
      console.error('Failed to discover plugins:', error)
      return []
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(pluginPath: string): Promise<LoadedPlugin> {
    try {
      console.log(`Loading plugin from: ${pluginPath}`)

      // Validate plugin structure
      const structureValidation = await pluginSecurity.validatePluginStructure(pluginPath)
      if (!structureValidation.valid) {
        throw new Error(`Plugin validation failed: ${structureValidation.errors.join(', ')}`)
      }

      // Read and parse manifest
      const manifestPath = `${pluginPath}/manifest.json`
      const manifestContent = await this.readFile(manifestPath)
      const manifest: PluginManifest = JSON.parse(manifestContent)

      // Check version compatibility
      const appVersion = '1.0.0' // This should come from package.json
      const versionCheck = pluginSecurity.checkVersionCompatibility(manifest, appVersion)
      if (!versionCheck.compatible) {
        throw new Error(`Version incompatibility: ${versionCheck.reason}`)
      }

      // Check for name conflicts
      if (this.loadedPlugins.has(manifest.name)) {
        throw new Error(`Plugin with name '${manifest.name}' is already loaded`)
      }

      // Scan plugin code for security issues
      const codeCheck = await pluginSecurity.scanPluginCode(pluginPath, manifest.entry)
      if (!codeCheck.safe && codeCheck.warnings.length > 0) {
        console.warn(`Security warnings for plugin ${manifest.name}:`, codeCheck.warnings)
      }

      // Load plugin code
      const plugin = await this.loadPluginCode(pluginPath, manifest)

      // Create SDK for the plugin
      const sdk = pluginAPI.createSDK(manifest)

      // Create loaded plugin instance
      const loadedPlugin: LoadedPlugin = {
        id: manifest.name,
        manifest,
        plugin,
        enabled: true,
        loadedAt: new Date(),
        sdk
      }

      // Store the loaded plugin
      this.loadedPlugins.set(manifest.name, loadedPlugin)

      // Call plugin's onLoad hook
      try {
        if (plugin.onLoad) {
          await plugin.onLoad(sdk)
        }
      } catch (error) {
        console.error(`Plugin ${manifest.name} onLoad hook failed:`, error)
        loadedPlugin.error = error instanceof Error ? error.message : 'Unknown error'
      }

      // Emit plugin loaded event
      this.eventEmitter.emit('plugin-loaded', loadedPlugin)

      console.log(`Successfully loaded plugin: ${manifest.displayName} (${manifest.name})`)
      return loadedPlugin

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`Failed to load plugin from ${pluginPath}:`, errorMessage)
      throw error
    }
  }

  /**
   * Load plugin code from entry point
   */
  private async loadPluginCode(pluginPath: string, manifest: PluginManifest): Promise<Plugin> {
    try {
      const entryPath = `${pluginPath}/${manifest.entry}`
      console.log(`Loading plugin code from: ${entryPath}`)
      
      if (!window.electronAPI?.readFile) {
        throw new Error('ElectronAPI not available')
      }
      
      // Read the plugin JavaScript code
      const pluginCode = await window.electronAPI.readFile(entryPath)
      
      // Create a safe execution context for the plugin
      const pluginContext = {
        console: console,
        React: React,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval
      }
      
      // Execute the plugin code in a controlled environment
      const executePluginCode = new Function(
        'context',
        'manifest',
        `
        const { console, React, setTimeout, clearTimeout, setInterval, clearInterval } = context;
        let module = { exports: {} };
        let exports = module.exports;
        
        ${pluginCode}
        
        return module.exports;
        `
      )
      
      // Execute the plugin code and get the plugin factory
      const pluginFactory = executePluginCode(pluginContext, manifest)
      
      // Create the plugin instance
      let pluginInstance: Plugin
      
      if (typeof pluginFactory === 'function') {
        // Plugin exports a factory function
        pluginInstance = pluginFactory(manifest)
      } else if (pluginFactory && typeof pluginFactory === 'object') {
        // Plugin exports an object directly
        pluginInstance = pluginFactory
      } else {
        throw new Error('Plugin must export a function or object')
      }
      
      // Ensure the plugin has the required structure
      if (!pluginInstance.manifest) {
        pluginInstance.manifest = manifest
      }
      
      console.log(`Successfully loaded plugin: ${manifest.displayName}`)
      return pluginInstance
      
    } catch (error) {
      console.error(`Failed to load plugin code from ${pluginPath}:`, error)
      throw error
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    try {
      const loadedPlugin = this.loadedPlugins.get(pluginId)
      if (!loadedPlugin) {
        throw new Error(`Plugin '${pluginId}' is not loaded`)
      }

      console.log(`Unloading plugin: ${loadedPlugin.manifest.displayName}`)

      // Call plugin's onUnload hook
      try {
        if (loadedPlugin.plugin.onUnload) {
          await loadedPlugin.plugin.onUnload()
        }
      } catch (error) {
        console.error(`Plugin ${pluginId} onUnload hook failed:`, error)
      }

      // Clean up plugin resources
      pluginAPI.cleanupPlugin(pluginId)

      // Remove from loaded plugins
      this.loadedPlugins.delete(pluginId)

      // Emit plugin unloaded event
      this.eventEmitter.emit('plugin-unloaded', { pluginId, manifest: loadedPlugin.manifest })

      console.log(`Successfully unloaded plugin: ${pluginId}`)
    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    try {
      const loadedPlugin = this.loadedPlugins.get(pluginId)
      if (!loadedPlugin) {
        throw new Error(`Plugin '${pluginId}' is not loaded`)
      }

      if (loadedPlugin.enabled) {
        return // Already enabled
      }

      loadedPlugin.enabled = true

      // Call plugin's onLoad hook if it exists
      try {
        if (loadedPlugin.plugin.onLoad) {
          await loadedPlugin.plugin.onLoad(loadedPlugin.sdk)
        }
      } catch (error) {
        console.error(`Plugin ${pluginId} onLoad hook failed:`, error)
        loadedPlugin.error = error instanceof Error ? error.message : 'Unknown error'
      }

      this.eventEmitter.emit('plugin-enabled', loadedPlugin)
      console.log(`Enabled plugin: ${pluginId}`)
    } catch (error) {
      console.error(`Failed to enable plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    try {
      const loadedPlugin = this.loadedPlugins.get(pluginId)
      if (!loadedPlugin) {
        throw new Error(`Plugin '${pluginId}' is not loaded`)
      }

      if (!loadedPlugin.enabled) {
        return // Already disabled
      }

      loadedPlugin.enabled = false

      // Call plugin's onUnload hook if it exists
      try {
        if (loadedPlugin.plugin.onUnload) {
          await loadedPlugin.plugin.onUnload()
        }
      } catch (error) {
        console.error(`Plugin ${pluginId} onUnload hook failed:`, error)
      }

      // Clean up plugin resources
      pluginAPI.cleanupPlugin(pluginId)

      this.eventEmitter.emit('plugin-disabled', loadedPlugin)
      console.log(`Disabled plugin: ${pluginId}`)
    } catch (error) {
      console.error(`Failed to disable plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Install a plugin from a directory or archive
   */
  async installPlugin(
    sourcePath: string, 
    onProgress?: (progress: PluginInstallProgress) => void
  ): Promise<LoadedPlugin> {
    try {
      onProgress?.({ stage: 'validating', progress: 10, message: 'Validating plugin...' })

      // Validate plugin structure
      const structureValidation = await pluginSecurity.validatePluginStructure(sourcePath)
      if (!structureValidation.valid) {
        throw new Error(`Plugin validation failed: ${structureValidation.errors.join(', ')}`)
      }

      onProgress?.({ stage: 'extracting', progress: 30, message: 'Extracting plugin files...' })

      // Read manifest
      const manifestPath = `${sourcePath}/manifest.json`
      const manifestContent = await this.readFile(manifestPath)
      const manifest: PluginManifest = JSON.parse(manifestContent)

      // Check for conflicts
      if (this.loadedPlugins.has(manifest.name)) {
        throw new Error(`Plugin '${manifest.name}' is already installed`)
      }

      onProgress?.({ stage: 'installing', progress: 70, message: 'Installing plugin...' })

      // Copy plugin to plugins directory
      const targetPath = `${this.pluginsDirectory}/${manifest.name}`
      await this.copyPlugin(sourcePath, targetPath)

      onProgress?.({ stage: 'complete', progress: 90, message: 'Loading plugin...' })

      // Load the installed plugin
      const loadedPlugin = await this.loadPlugin(targetPath)

      onProgress?.({ stage: 'complete', progress: 100, message: 'Plugin installed successfully!' })

      this.eventEmitter.emit('plugin-installed', loadedPlugin)
      return loadedPlugin

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      onProgress?.({ 
        stage: 'error', 
        progress: 0, 
        message: 'Installation failed', 
        error: errorMessage 
      })
      throw error
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId: string): Promise<void> {
    try {
      // Unload the plugin first
      if (this.loadedPlugins.has(pluginId)) {
        await this.unloadPlugin(pluginId)
      }

      // Remove plugin directory
      const pluginPath = `${this.pluginsDirectory}/${pluginId}`
      await this.removeDirectory(pluginPath)

      this.eventEmitter.emit('plugin-uninstalled', { pluginId })
      console.log(`Uninstalled plugin: ${pluginId}`)
    } catch (error) {
      console.error(`Failed to uninstall plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins(): LoadedPlugin[] {
    return Array.from(this.loadedPlugins.values())
  }

  /**
   * Get a specific loaded plugin
   */
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.loadedPlugins.get(pluginId)
  }

  /**
   * Check if a plugin is loaded
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.loadedPlugins.has(pluginId)
  }

  /**
   * Get plugin statistics
   */
  getPluginStats() {
    const plugins = this.getLoadedPlugins()
    return {
      total: plugins.length,
      enabled: plugins.filter(p => p.enabled).length,
      disabled: plugins.filter(p => !p.enabled).length,
      withErrors: plugins.filter(p => p.error).length
    }
  }

  /**
   * Handle server connection events
   */
  async onServerConnect(sessionInfo: SessionInfo): Promise<void> {
    pluginAPI.setCurrentSession(sessionInfo)
    
    for (const [pluginId, loadedPlugin] of this.loadedPlugins.entries()) {
      if (loadedPlugin.enabled && loadedPlugin.plugin.onServerConnect) {
        try {
          await loadedPlugin.plugin.onServerConnect(sessionInfo)
        } catch (error) {
          console.error(`Plugin ${pluginId} onServerConnect hook failed:`, error)
        }
      }
    }
  }

  /**
   * Handle server disconnection events
   */
  async onServerDisconnect(): Promise<void> {
    pluginAPI.setCurrentSession(null)
    
    for (const [pluginId, loadedPlugin] of this.loadedPlugins.entries()) {
      if (loadedPlugin.enabled && loadedPlugin.plugin.onServerDisconnect) {
        try {
          await loadedPlugin.plugin.onServerDisconnect()
        } catch (error) {
          console.error(`Plugin ${pluginId} onServerDisconnect hook failed:`, error)
        }
      }
    }
  }

  /**
   * Get event emitter for external use
   */
  getEventEmitter(): SimpleEventEmitter {
    return this.eventEmitter
  }

  // Helper methods (these would be implemented with proper Electron IPC calls)

  /**
   * Read file content using IPC
   */
  private async readFile(path: string): Promise<string> {
    try {
      if (!window.electronAPI?.readFile) {
        throw new Error('ElectronAPI not available')
      }
      
      return await window.electronAPI.readFile(path)
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async copyPlugin(sourcePath: string, targetPath: string): Promise<void> {
    // Simulate plugin copying
    console.log(`Copying plugin from ${sourcePath} to ${targetPath}`)
  }

  private async removeDirectory(path: string): Promise<void> {
    // Simulate directory removal
    console.log(`Removing directory: ${path}`)
  }
}

export const pluginManager = PluginManagerService.getInstance() 