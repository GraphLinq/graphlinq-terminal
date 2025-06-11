export interface Server {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKeyPath?: string
  description?: string
  category: string
  status: 'connected' | 'disconnected' | 'connecting'
}

class ServerService {
  private servers: Server[] = []
  private isLoaded = false

  constructor() {
    // Don't load immediately, wait for the component to request it
  }

  async loadServers(): Promise<Server[]> {
    if (this.isLoaded) {
      return this.servers
    }

    try {
      if (window.electronAPI) {
        console.log('Loading servers from file...')
        this.servers = await window.electronAPI.loadServers()
        console.log('Loaded servers:', this.servers)
      } else {
        console.warn('Electron API not available, using empty array')
        this.servers = []
      }
      this.isLoaded = true
      return this.servers
    } catch (error) {
      console.error('Error loading servers:', error)
      this.servers = []
      this.isLoaded = true
      return this.servers
    }
  }

  getAllServers(): Server[] {
    return [...this.servers]
  }

  getServerById(id: string): Server | undefined {
    return this.servers.find(server => server.id === id)
  }

  async addServer(serverData: Omit<Server, 'id' | 'status'>): Promise<Server> {
    const newServer: Server = {
      ...serverData,
      id: this.generateId(),
      status: 'disconnected'
    }
    
    this.servers.push(newServer)
    await this.saveServers()
    return newServer
  }

  async updateServer(id: string, updates: Partial<Server>): Promise<Server | null> {
    const index = this.servers.findIndex(server => server.id === id)
    if (index === -1) return null

    this.servers[index] = { ...this.servers[index], ...updates }
    await this.saveServers()
    return this.servers[index]
  }

  async deleteServer(id: string): Promise<boolean> {
    const index = this.servers.findIndex(server => server.id === id)
    if (index === -1) return false

    this.servers.splice(index, 1)
    await this.saveServers()
    return true
  }

  updateServerStatus(id: string, status: Server['status']): void {
    const server = this.servers.find(s => s.id === id)
    if (server) {
      server.status = status
      // Note: On ne sauvegarde pas le statut car c'est temporaire
    }
  }

  getServersByCategory(category: string): Server[] {
    return this.servers.filter(server => server.category === category)
  }

  private generateId(): string {
    return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private async saveServers(): Promise<void> {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.saveServers(this.servers)
        if (success) {
          console.log('Servers saved successfully to file')
        } else {
          console.error('Failed to save servers to file')
        }
      } else {
        console.warn('Electron API not available, cannot save to file')
      }
    } catch (error) {
      console.error('Error saving servers:', error)
    }
  }

  async getFilePath(): Promise<string> {
    try {
      if (window.electronAPI) {
        return await window.electronAPI.getServersFilePath()
      }
      return 'Electron API not available'
    } catch (error) {
      console.error('Error getting file path:', error)
      return 'Error getting file path'
    }
  }

  // Reset servers to default (useful for testing)
  async resetToDefault(): Promise<void> {
    this.servers = []
    this.isLoaded = false
    await this.loadServers()
  }
}

export const serverService = new ServerService()
export default serverService 