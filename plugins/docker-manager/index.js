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
      
      // Load saved preferences
      await this.loadPreferences(sdk)
      
      // Check if there's already an active session
      const currentSession = sdk.terminal.getCurrentSession()
      if (currentSession) {
        console.log('Docker Manager: Found existing session, checking Docker availability with delay...')
        // Add delay even for existing sessions to ensure they're stable
        setTimeout(async () => {
          await this.checkDockerAvailability(sdk)
          
          if (this.isDockerAvailable) {
            sdk.ui.showNotification('Docker detected on server!', 'success')
          } else {
            sdk.ui.showNotification('Docker not found on this server', 'warning')
          }
        }, 1500) // 1.5 second delay for existing sessions
      } else {
        console.log('Docker Manager: Waiting for server connection to check Docker availability...')
      }
      
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
    
    // Add a small additional delay to ensure the session is fully ready
    setTimeout(async () => {
      if (this.sdk) {
        console.log('Docker Manager: Checking Docker availability after connection stabilization...')
        await this.checkDockerAvailability(this.sdk)
        
        if (this.isDockerAvailable) {
          this.sdk.ui.showNotification('Docker detected on server!', 'success')
        } else {
          this.sdk.ui.showNotification('Docker not found on this server', 'warning')
        }
      }
    }, 1000) // Additional 1 second delay
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
      
      // Try with a longer timeout and simpler command first
      const result = await sdk.terminal.execute('which docker', { timeout: 15000 })
      
      if (result.exitCode === 0 && result.stdout && result.stdout.trim()) {
        // Docker binary exists, now check version
        try {
          const versionResult = await sdk.terminal.execute('docker --version', { timeout: 10000 })
          if (versionResult.exitCode === 0 && versionResult.stdout) {
            this.isDockerAvailable = true
            console.log('Docker is available:', versionResult.stdout.trim())
            return true
          }
        } catch (versionError) {
          console.log('Docker binary found but version check failed:', versionError.message)
        }
      }
      
      // If we get here, Docker is not available
      this.isDockerAvailable = false
      console.log('Docker not available - binary not found or not accessible')
      return false
      
    } catch (error) {
      console.log('Error checking Docker availability:', error.message)
      
      // If it's a timeout error, try one more time with a basic test
      if (error.message.includes('Timeout')) {
        console.log('Timeout occurred, trying basic Docker test...')
        try {
          const basicResult = await sdk.terminal.execute('docker info --format "{{.ServerVersion}}"', { timeout: 20000 })
          if (basicResult.exitCode === 0) {
            this.isDockerAvailable = true
            console.log('Docker is available (detected via docker info)')
            return true
          }
        } catch (basicError) {
          console.log('Basic Docker test also failed:', basicError.message)
        }
      }
      
      this.isDockerAvailable = false
      return false
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
      const [containers, setContainers] = React.useState([])
      const [images, setImages] = React.useState([])
      const [isLoading, setIsLoading] = React.useState(false)
      const [lastUpdate, setLastUpdate] = React.useState(null)
      
      // Refresh containers function
      const handleRefreshContainers = async () => {
        if (!self.isDockerAvailable || !self.sdk) return
        
        setIsLoading(true)
        try {
          console.log('Refreshing containers...')
          // Use the improved plugin API that handles output properly
          const result = await self.sdk.terminal.execute('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}"', {
            timeout: 8000 // Reduced timeout for faster response
          })
          
          if (result.exitCode === 0 && result.stdout) {
            console.log('Docker ps output:', result.stdout)
            
            // Parse the formatted output
            const lines = result.stdout.split('\n').filter(line => line.trim())
            const containerList = []
            
            for (const line of lines) {
              if (line.includes('|')) {
                const [id, name, status, image] = line.split('|')
                if (name && name.trim()) {
                  containerList.push({ 
                    id: id?.trim() || 'unknown',
                    name: name.trim(), 
                    status: status?.trim() || 'unknown', 
                    image: image?.trim() || 'unknown' 
                  })
                }
              }
            }
            
            setContainers(containerList)
            self.containers = containerList
            setLastUpdate(new Date().toLocaleTimeString())
            console.log('Parsed containers:', containerList)
            self.sdk.ui.showNotification(`Found ${containerList.length} containers`, 'info')
          } else {
            console.error('Docker command failed:', result.stderr || 'No output')
            self.sdk.ui.showNotification('Failed to refresh containers - check if Docker is running', 'error')
          }
        } catch (error) {
          console.error('Failed to refresh containers:', error)
          self.sdk.ui.showNotification('Failed to refresh containers: ' + error.message, 'error')
        } finally {
          setIsLoading(false)
        }
      }
      
      // Refresh images function
      const handleRefreshImages = async () => {
        if (!self.isDockerAvailable || !self.sdk) return
        
        setIsLoading(true)
        try {
          console.log('Refreshing images...')
          // Use the improved plugin API that handles output properly
          const result = await self.sdk.terminal.execute('docker images --format "{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}"', {
            timeout: 8000 // Reduced timeout for faster response
          })
          
          if (result.exitCode === 0 && result.stdout) {
            console.log('Docker images output:', result.stdout)
            
            // Parse the formatted output
            const lines = result.stdout.split('\n').filter(line => line.trim())
            const imageList = []
            
            for (const line of lines) {
              if (line.includes('|')) {
                const [id, repository, tag, size] = line.split('|')
                if (repository && repository.trim()) {
                  imageList.push({ 
                    id: id?.trim() || 'unknown',
                    repository: repository.trim(), 
                    tag: tag?.trim() || 'latest', 
                    size: size?.trim() || 'unknown' 
                  })
                }
              }
            }
            
            setImages(imageList)
            self.images = imageList
            setLastUpdate(new Date().toLocaleTimeString())
            console.log('Parsed images:', imageList)
            self.sdk.ui.showNotification(`Found ${imageList.length} images`, 'info')
          } else {
            console.error('Docker command failed:', result.stderr || 'No output')
            self.sdk.ui.showNotification('Failed to refresh images - check if Docker is running', 'error')
          }
        } catch (error) {
          console.error('Failed to refresh images:', error)
          self.sdk.ui.showNotification('Failed to refresh images: ' + error.message, 'error')
        } finally {
          setIsLoading(false)
        }
      }
      
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
        
        // Last update info
        lastUpdate && React.createElement('div', {
          key: 'last-update',
          style: { fontSize: '12px', color: '#888', marginBottom: '12px' }
        }, `Last update: ${lastUpdate}`),
        
        // Refresh buttons
        React.createElement('div', {
          key: 'buttons',
          style: { marginBottom: '16px' }
        }, [
          React.createElement('button', {
            key: 'refresh-containers',
            style: {
              padding: '8px 16px',
              backgroundColor: self.isDockerAvailable && !isLoading ? '#007acc' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: self.isDockerAvailable && !isLoading ? 'pointer' : 'not-allowed',
              marginRight: '8px'
            },
            disabled: !self.isDockerAvailable || isLoading,
            onClick: handleRefreshContainers
          }, isLoading ? 'Loading...' : 'Refresh Containers'),
          
          React.createElement('button', {
            key: 'refresh-images',
            style: {
              padding: '8px 16px',
              backgroundColor: self.isDockerAvailable && !isLoading ? '#28a745' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: self.isDockerAvailable && !isLoading ? 'pointer' : 'not-allowed'
            },
            disabled: !self.isDockerAvailable || isLoading,
            onClick: handleRefreshImages
          }, isLoading ? 'Loading...' : 'Refresh Images')
        ]),
        
        // Containers list
        containers.length > 0 && React.createElement('div', {
          key: 'containers-section',
          style: { marginBottom: '16px' }
        }, [
          React.createElement('h4', { key: 'containers-title' }, `Containers (${containers.length})`),
          React.createElement('div', {
            key: 'containers-list',
            style: { fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }
          }, containers.map((container, index) => 
            React.createElement('div', {
              key: `container-${index}`,
              style: { 
                padding: '8px', 
                margin: '4px 0', 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)'
              }
            }, [
              // Container info
              React.createElement('div', {
                key: 'info',
                style: { 
                  fontWeight: 'bold', 
                  marginBottom: '4px',
                  color: container.status.includes('Up') ? '#10b981' : '#ef4444'
                }
              }, `${container.name}`),
              React.createElement('div', {
                key: 'status',
                style: { fontSize: '11px', color: '#888', marginBottom: '6px' }
              }, `Status: ${container.status} | Image: ${container.image}`),
              
              // Action buttons
              React.createElement('div', {
                key: 'actions',
                style: { display: 'flex', gap: '4px', flexWrap: 'wrap' }
              }, [
                // Start button (only if stopped)
                !container.status.includes('Up') && React.createElement('button', {
                  key: 'start',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk) {
                      try {
                        const result = await self.sdk.terminal.execute(`docker start ${container.name}`, { timeout: 10000 })
                        if (result.exitCode === 0) {
                          self.sdk.ui.showNotification(`Started ${container.name}`, 'success')
                        } else {
                          self.sdk.ui.showNotification(`Failed to start ${container.name}: ${result.stderr}`, 'error')
                        }
                        setTimeout(() => handleRefreshContainers(), 2000)
                      } catch (error) {
                        self.sdk.ui.showNotification(`Failed to start ${container.name}: ${error.message}`, 'error')
                      }
                    }
                  }
                }, '▶ Start'),
                
                // Stop button (only if running)
                container.status.includes('Up') && React.createElement('button', {
                  key: 'stop',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk) {
                      try {
                        const result = await self.sdk.terminal.execute(`docker stop ${container.name}`, { timeout: 15000 })
                        if (result.exitCode === 0) {
                          self.sdk.ui.showNotification(`Stopped ${container.name}`, 'success')
                        } else {
                          self.sdk.ui.showNotification(`Failed to stop ${container.name}: ${result.stderr}`, 'error')
                        }
                        setTimeout(() => handleRefreshContainers(), 2000)
                      } catch (error) {
                        self.sdk.ui.showNotification(`Failed to stop ${container.name}: ${error.message}`, 'error')
                      }
                    }
                  }
                }, '⏹ Stop'),
                
                // Restart button
                React.createElement('button', {
                  key: 'restart',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk) {
                      try {
                        const result = await self.sdk.terminal.execute(`docker restart ${container.name}`, { timeout: 20000 })
                        if (result.exitCode === 0) {
                          self.sdk.ui.showNotification(`Restarted ${container.name}`, 'success')
                        } else {
                          self.sdk.ui.showNotification(`Failed to restart ${container.name}: ${result.stderr}`, 'error')
                        }
                        setTimeout(() => handleRefreshContainers(), 3000)
                      } catch (error) {
                        self.sdk.ui.showNotification(`Failed to restart ${container.name}: ${error.message}`, 'error')
                      }
                    }
                  }
                }, '🔄 Restart'),
                
                // Logs button
                React.createElement('button', {
                  key: 'logs',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk) {
                      try {
                        const result = await self.sdk.terminal.execute(`docker logs --tail 20 ${container.name}`)
                        console.log(`Logs for ${container.name}:`, result.stdout)
                        self.sdk.ui.showNotification(`Logs displayed in console for ${container.name}`, 'info')
                      } catch (error) {
                        self.sdk.ui.showNotification(`Failed to get logs for ${container.name}`, 'error')
                      }
                    }
                  }
                }, '📋 Logs'),
                
                // Remove button (only if stopped)
                !container.status.includes('Up') && React.createElement('button', {
                  key: 'remove',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk && confirm(`Are you sure you want to remove container ${container.name}?`)) {
                      try {
                        await self.sdk.terminal.execute(`docker rm ${container.name}`)
                        self.sdk.ui.showNotification(`Removed ${container.name}`, 'success')
                        setTimeout(() => handleRefreshContainers(), 1000)
                      } catch (error) {
                        self.sdk.ui.showNotification(`Failed to remove ${container.name}`, 'error')
                      }
                    }
                  }
                }, '🗑 Remove')
              ])
            ])
          ))
        ]),
        
        // Images list
        images.length > 0 && React.createElement('div', {
          key: 'images-section'
        }, [
          React.createElement('h4', { key: 'images-title' }, `Images (${images.length})`),
          React.createElement('div', {
            key: 'images-list',
            style: { fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }
          }, images.map((image, index) => 
            React.createElement('div', {
              key: `image-${index}`,
              style: { 
                padding: '8px', 
                margin: '4px 0', 
                backgroundColor: 'rgba(255,255,255,0.1)', 
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.2)'
              }
            }, [
              // Image info
              React.createElement('div', {
                key: 'info',
                style: { fontWeight: 'bold', marginBottom: '4px' }
              }, `${image.repository}:${image.tag}`),
              React.createElement('div', {
                key: 'size',
                style: { fontSize: '11px', color: '#888', marginBottom: '6px' }
              }, `Size: ${image.size}`),
              
              // Action buttons for images
              React.createElement('div', {
                key: 'actions',
                style: { display: 'flex', gap: '4px', flexWrap: 'wrap' }
              }, [
                // Run button
                React.createElement('button', {
                  key: 'run',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk) {
                      const containerName = prompt(`Enter container name for ${image.repository}:${image.tag}:`)
                      if (containerName) {
                        try {
                          await self.sdk.terminal.execute(`docker run -d --name ${containerName} ${image.repository}:${image.tag}`)
                          self.sdk.ui.showNotification(`Started container ${containerName}`, 'success')
                          setTimeout(() => handleRefreshContainers(), 2000)
                        } catch (error) {
                          self.sdk.ui.showNotification(`Failed to run ${image.repository}:${image.tag}`, 'error')
                        }
                      }
                    }
                  }
                }, '▶ Run'),
                
                // Pull button (update image)
                React.createElement('button', {
                  key: 'pull',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk) {
                      try {
                        await self.sdk.terminal.execute(`docker pull ${image.repository}:${image.tag}`)
                        self.sdk.ui.showNotification(`Pulling ${image.repository}:${image.tag}...`, 'info')
                        setTimeout(() => handleRefreshImages(), 5000)
                      } catch (error) {
                        self.sdk.ui.showNotification(`Failed to pull ${image.repository}:${image.tag}`, 'error')
                      }
                    }
                  }
                }, '⬇ Pull'),
                
                // Remove image button
                React.createElement('button', {
                  key: 'remove',
                  style: {
                    padding: '4px 8px',
                    fontSize: '10px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  },
                  onClick: async () => {
                    if (self.sdk && confirm(`Are you sure you want to remove image ${image.repository}:${image.tag}?`)) {
                      try {
                        await self.sdk.terminal.execute(`docker rmi ${image.repository}:${image.tag}`)
                        self.sdk.ui.showNotification(`Removed image ${image.repository}:${image.tag}`, 'success')
                        setTimeout(() => handleRefreshImages(), 1000)
                      } catch (error) {
                        self.sdk.ui.showNotification(`Failed to remove ${image.repository}:${image.tag}`, 'error')
                      }
                    }
                  }
                }, '🗑 Remove')
              ])
            ])
          ))
        ])
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