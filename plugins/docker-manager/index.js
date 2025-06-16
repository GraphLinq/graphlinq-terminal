// Docker Manager Plugin for GraphLinq Terminal
// This is an example plugin that demonstrates the plugin system capabilities

class DockerManagerPlugin {
  constructor(manifest) {
    this.manifest = manifest
    this.panelId = null
    this.containers = []
    this.images = []
    this.isDockerAvailable = false
    this.sdk = null
  }

  // Plugin lifecycle hook - called when plugin is loaded
  async onLoad(sdk) {
    console.log('Docker Manager plugin loading...')
    
    try {
      // Store SDK reference for later use
      this.sdk = sdk
      
      // Add Docker sidebar panel
      this.panelId = sdk.ui.addSidebarPanel({
        id: 'docker-panel',
        title: 'Docker',
        icon: '🐳',
        component: this.createDockerPanel()
      })
      
      // Show welcome notification
      sdk.ui.showNotification('Docker Manager plugin loaded successfully!', 'success')
      
      // Store initialization data
      await sdk.storage.set('initialized', true)
      await sdk.storage.set('lastLoaded', new Date().toISOString())
      
      console.log(`Docker Manager: Added sidebar panel ${this.panelId}`)
      
      // Load saved preferences (don't check Docker yet - no connection)
      await this.loadPreferences(sdk)
      
      console.log('Docker Manager: Waiting for server connection to check Docker availability...')
      
    } catch (error) {
      console.error('Docker Manager plugin load error:', error)
      sdk.ui.showNotification('Failed to load Docker Manager plugin', 'error')
    }
  }

  // Plugin lifecycle hook - called when plugin is unloaded
  async onUnload() {
    console.log('Docker Manager plugin unloading...')
    this.sdk = null
  }

  // Called when server connection is established
  async onServerConnect(serverInfo) {
    console.log(`Docker Manager: Connected to ${serverInfo.host}`)
    
    // Now we can check Docker availability since we have a connection
    if (this.sdk) {
      await this.checkDockerAvailability(this.sdk)
      
      if (this.isDockerAvailable) {
        this.sdk.ui.showNotification('Docker detected on server!', 'success')
      } else {
        this.sdk.ui.showNotification('Docker not found on this server', 'warning')
      }
    }
  }

  // Called when server connection is lost
  async onServerDisconnect() {
    console.log('Docker Manager: Server disconnected')
    this.containers = []
    this.images = []
    this.isDockerAvailable = false
    
    if (this.sdk) {
      this.sdk.ui.showNotification('Disconnected from server', 'info')
    }
  }

  // Check if Docker is available on the connected server
  async checkDockerAvailability(sdk) {
    try {
      console.log('Checking Docker availability...')
      const result = await sdk.terminal.execute('docker --version')
      
      if (result.exitCode === 0) {
        this.isDockerAvailable = true
        console.log('Docker is available:', result.stdout.trim())
      } else {
        this.isDockerAvailable = false
        console.log('Docker not available - exit code:', result.exitCode)
      }
    } catch (error) {
      console.log('Error checking Docker availability:', error.message)
      this.isDockerAvailable = false
    }
  }

  // Load user preferences
  async loadPreferences(sdk) {
    try {
      const preferences = await sdk.storage.get('preferences')
      if (preferences) {
        console.log('Loaded Docker Manager preferences:', preferences)
      }
    } catch (error) {
      console.log('No saved preferences found')
    }
  }

  // Save user preferences
  async savePreferences(sdk, preferences) {
    try {
      await sdk.storage.set('preferences', preferences)
      console.log('Saved Docker Manager preferences')
    } catch (error) {
      console.error('Failed to save preferences:', error)
    }
  }

  // Refresh containers list
  async refreshContainers(sdk) {
    if (!this.isDockerAvailable) {
      sdk.ui.showNotification('Docker is not available', 'warning')
      return
    }

    try {
      const result = await sdk.terminal.execute('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}"')
      
      if (result.exitCode === 0) {
        this.containers = result.stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [id, name, status, image] = line.split('|')
            return { id, name, status, image }
          })
        
        console.log('Refreshed containers:', this.containers.length)
        sdk.ui.showNotification(`Found ${this.containers.length} containers`, 'info')
      }
    } catch (error) {
      console.error('Failed to refresh containers:', error)
      sdk.ui.showNotification('Failed to refresh containers', 'error')
    }
  }

  // Refresh images list
  async refreshImages(sdk) {
    if (!this.isDockerAvailable) {
      sdk.ui.showNotification('Docker is not available', 'warning')
      return
    }

    try {
      const result = await sdk.terminal.execute('docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}"')
      
      if (result.exitCode === 0) {
        this.images = result.stdout.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [id, repository, tag, size] = line.split('|')
            return { id, repository, tag, size }
          })
        
        console.log('Refreshed images:', this.images.length)
        sdk.ui.showNotification(`Found ${this.images.length} images`, 'info')
      }
    } catch (error) {
      console.error('Failed to refresh images:', error)
      sdk.ui.showNotification('Failed to refresh images', 'error')
    }
  }

  // Create Docker panel component (simplified representation)
  createDockerPanel() {
    const self = this
    
    // Return a React component factory
    return function DockerPanel() {
      return React.createElement('div', {
        className: 'docker-panel',
        style: {
          padding: '16px',
          color: '#ffffff',
          fontSize: '14px'
        }
      }, [
        React.createElement('h3', { key: 'title' }, '🐳 Docker Manager'),
        React.createElement('p', { key: 'desc' }, 'Manage your Docker containers and images'),
        React.createElement('div', { 
          key: 'status',
          style: { marginBottom: '12px' }
        }, `Status: ${self.isDockerAvailable ? 'Docker Available' : 'Waiting for connection...'}`),
        React.createElement('button', {
          key: 'refresh',
          style: {
            marginTop: '8px',
            padding: '8px 16px',
            backgroundColor: self.isDockerAvailable ? '#007acc' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: self.isDockerAvailable ? 'pointer' : 'not-allowed'
          },
          disabled: !self.isDockerAvailable,
          onClick: () => {
            if (self.isDockerAvailable && self.sdk) {
              console.log('Docker refresh clicked')
              self.refreshContainers(self.sdk)
            }
          }
        }, 'Refresh Containers'),
        React.createElement('button', {
          key: 'refresh-images',
          style: {
            marginTop: '8px',
            marginLeft: '8px',
            padding: '8px 16px',
            backgroundColor: self.isDockerAvailable ? '#28a745' : '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: self.isDockerAvailable ? 'pointer' : 'not-allowed'
          },
          disabled: !self.isDockerAvailable,
          onClick: () => {
            if (self.isDockerAvailable && self.sdk) {
              console.log('Docker refresh images clicked')
              self.refreshImages(self.sdk)
            }
          }
        }, 'Refresh Images')
      ])
    }
  }
}

// Plugin commands
const commands = {
  'list-containers': async (args, sdk) => {
    try {
      const result = await sdk.terminal.execute('docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Image}}"')
      return result.stdout
    } catch (error) {
      sdk.ui.showNotification('Failed to list Docker containers', 'error')
      throw error
    }
  },
  
  'list-images': async (args, sdk) => {
    try {
      const result = await sdk.terminal.execute('docker images --format "table {{.Repository}}\\t{{.Tag}}\\t{{.Size}}"')
      return result.stdout
    } catch (error) {
      sdk.ui.showNotification('Failed to list Docker images', 'error')
      throw error
    }
  },
  
  'start-container': async (args, sdk) => {
    const containerName = args[0]
    if (!containerName) {
      throw new Error('Container name is required')
    }
    
    try {
      await sdk.terminal.execute(`docker start ${containerName}`)
      sdk.ui.showNotification(`Container ${containerName} started`, 'success')
      return `Container ${containerName} started successfully`
    } catch (error) {
      sdk.ui.showNotification(`Failed to start container ${containerName}`, 'error')
      throw error
    }
  },
  
  'stop-container': async (args, sdk) => {
    const containerName = args[0]
    if (!containerName) {
      throw new Error('Container name is required')
    }
    
    try {
      await sdk.terminal.execute(`docker stop ${containerName}`)
      sdk.ui.showNotification(`Container ${containerName} stopped`, 'success')
      return `Container ${containerName} stopped successfully`
    } catch (error) {
      sdk.ui.showNotification(`Failed to stop container ${containerName}`, 'error')
      throw error
    }
  }
}

// Export plugin factory function
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = function createPlugin(manifest) {
    const plugin = new DockerManagerPlugin(manifest)
    plugin.commands = commands
    return plugin
  }
} else {
  // Browser environment - attach to global scope
  window.createDockerManagerPlugin = function(manifest) {
    const plugin = new DockerManagerPlugin(manifest)
    plugin.commands = commands
    return plugin
  }
} 