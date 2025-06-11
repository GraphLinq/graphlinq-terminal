export interface SSHConnectionConfig {
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKeyPath?: string
}

export interface SSHConnectionResult {
  success: boolean
  error?: string
  sessionId?: string
}

export interface SSHCommandResult {
  success: boolean
  output?: string
  error?: string
}

export class SSHService {
  async testConnection(config: SSHConnectionConfig): Promise<{
    reachable: boolean;
    authMethods: string[];
    error?: string;
  }> {
    if (!window.electronAPI) {
      return {
        reachable: false,
        authMethods: [],
        error: 'Electron API not available'
      }
    }

    try {
      const result = await window.electronAPI.sshTestConnection(config)
      return result
    } catch (error: any) {
      return {
        reachable: false,
        authMethods: [],
        error: error?.message || 'Unknown error occurred'
      }
    }
  }

  async connect(config: SSHConnectionConfig): Promise<SSHConnectionResult> {
    if (!window.electronAPI) {
      return {
        success: false,
        error: 'Electron API not available'
      }
    }

    try {
      const result = await window.electronAPI.sshConnect(config)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unknown error occurred'
      }
    }
  }

  async write(sessionId: string, data: string): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) {
      return {
        success: false,
        error: 'Electron API not available'
      }
    }

    try {
      const result = await window.electronAPI.sshWrite(sessionId, data)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unknown error occurred'
      }
    }
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) {
      return {
        success: false,
        error: 'Electron API not available'
      }
    }

    try {
      const result = await window.electronAPI.sshResize(sessionId, cols, rows)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unknown error occurred'
      }
    }
  }

  async disconnect(sessionId: string): Promise<{ success: boolean; error?: string }> {
    if (!window.electronAPI) {
      return {
        success: false,
        error: 'Electron API not available'
      }
    }

    try {
      const result = await window.electronAPI.sshDisconnect(sessionId)
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unknown error occurred'
      }
    }
  }

  async getSessions(): Promise<{ success: boolean; sessions?: string[]; error?: string }> {
    if (!window.electronAPI) {
      return {
        success: false,
        error: 'Electron API not available',
        sessions: []
      }
    }

    try {
      const result = await window.electronAPI.sshGetSessions()
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unknown error occurred',
        sessions: []
      }
    }
  }

  onData(callback: (sessionId: string, data: string) => void): void {
    if (window.electronAPI) {
      window.electronAPI.onSSHData(callback)
    }
  }

  offData(): void {
    if (window.electronAPI) {
      window.electronAPI.offSSHData()
    }
  }
}

export const sshService = new SSHService() 