import { Client, ConnectConfig } from 'ssh2'
import { EventEmitter } from 'events'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

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

class SSHConnection extends EventEmitter {
  private client: Client
  private isConnected: boolean = false
  private sessionId: string
  private config: SSHConnectionConfig
  private shell: any = null
  private shellReady: boolean = false

  constructor(sessionId: string, config: SSHConnectionConfig) {
    super()
    this.sessionId = sessionId
    this.config = config
    this.client = new Client()
    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.client.on('ready', () => {
      console.log(`SSH connection ready for session ${this.sessionId}`)
      this.isConnected = true
      this.initializeShell()
      this.emit('ready')
    })

    this.client.on('error', (err) => {
      console.error(`SSH connection error for session ${this.sessionId}:`, err)
      this.isConnected = false
      this.emit('error', err)
    })

    this.client.on('end', () => {
      console.log(`SSH connection ended for session ${this.sessionId}`)
      this.isConnected = false
      this.shellReady = false
      this.emit('end')
    })

    this.client.on('close', () => {
      console.log(`SSH connection closed for session ${this.sessionId}`)
      this.isConnected = false
      this.shellReady = false
      this.emit('close')
    })
  }

  private async initializeShell(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.shell({
        term: 'xterm-256color',
        cols: 80,
        rows: 24
      }, (err, stream) => {
        if (err) {
          console.error('Failed to start shell:', err)
          reject(err)
          return
        }

        this.shell = stream
        this.shellReady = true
        
        // Forward all shell data to renderer
        stream.on('data', (data: Buffer) => {
          this.emit('data', data.toString())
        })

        stream.on('close', () => {
          this.shellReady = false
          this.emit('shell-close')
        })

        stream.on('error', (err: Error) => {
          console.error('Shell stream error:', err)
          this.emit('error', err)
        })

        console.log(`Shell initialized for session ${this.sessionId}`)
        resolve()
      })
    })
  }

  async connect(): Promise<SSHConnectionResult> {
    return new Promise((resolve) => {
      try {
        const connectConfig: ConnectConfig = {
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          readyTimeout: 30000,
          keepaliveInterval: 10000,
          keepaliveCountMax: 3,
          algorithms: {
            kex: [
              'ecdh-sha2-nistp256',
              'ecdh-sha2-nistp384',
              'ecdh-sha2-nistp521',
              'diffie-hellman-group-exchange-sha256',
              'diffie-hellman-group14-sha256',
              'diffie-hellman-group14-sha1',
              'diffie-hellman-group1-sha1'
            ],
            cipher: [
              'aes128-ctr',
              'aes192-ctr',
              'aes256-ctr',
              'aes128-gcm',
              'aes256-gcm',
              'aes128-cbc',
              'aes192-cbc',
              'aes256-cbc',
              '3des-cbc'
            ],
            hmac: [
              'hmac-sha2-256',
              'hmac-sha2-512',
              'hmac-sha1',
              'hmac-sha2-256-etm@openssh.com',
              'hmac-sha2-512-etm@openssh.com',
              'hmac-sha1-etm@openssh.com'
            ]
          }
        }

        if (this.config.authType === 'password' && this.config.password) {
          connectConfig.password = this.config.password
          this.tryAddDefaultPrivateKey(connectConfig)
        } else if (this.config.authType === 'privateKey' && this.config.privateKeyPath) {
          try {
            const keyPath = this.config.privateKeyPath.startsWith('~') 
              ? join(homedir(), this.config.privateKeyPath.slice(1))
              : this.config.privateKeyPath
            
            connectConfig.privateKey = readFileSync(keyPath)
            if (this.config.password) {
              connectConfig.passphrase = this.config.password
            }
          } catch (keyError: any) {
            console.error('Error reading private key:', keyError)
            if (this.config.password) {
              connectConfig.password = this.config.password
            } else {
              resolve({
                success: false,
                error: `Failed to read private key: ${keyError?.message || 'Unknown error'}`
              })
              return
            }
          }
        } else {
          this.tryAddDefaultPrivateKey(connectConfig)
          
          if (!connectConfig.privateKey && !this.config.password) {
            resolve({
              success: false,
              error: 'No authentication method available. Please provide password or private key.'
            })
            return
          }
        }

        this.client.once('ready', () => {
          console.log(`SSH connection established successfully for ${this.config.username}@${this.config.host}:${this.config.port}`)
          resolve({
            success: true,
            sessionId: this.sessionId
          })
        })

        this.client.once('error', (err) => {
          console.error(`SSH connection failed for ${this.config.username}@${this.config.host}:${this.config.port}:`, err)
          
          // Check if it's an algorithm error and try fallback
          if (err.message && err.message.includes('Unsupported algorithm')) {
            console.log('Attempting fallback connection with basic algorithms...')
            this.tryFallbackConnection(connectConfig, resolve)
          } else {
            resolve({
              success: false,
              error: this.formatErrorMessage(err)
            })
          }
        })

        console.log(`Attempting SSH connection to: ${this.config.host}:${this.config.port} as ${this.config.username}`)
        this.client.connect(connectConfig)
      } catch (error: any) {
        resolve({
          success: false,
          error: error?.message || 'Unknown error occurred'
        })
      }
    })
  }

  private tryFallbackConnection(
    baseConfig: any, 
    resolve: (value: SSHConnectionResult) => void
  ) {
    // Create a new client for fallback attempt
    const fallbackClient = new Client()
    
    // Use the most basic, widely supported algorithms
    const fallbackConfig = {
      ...baseConfig,
      algorithms: {
        kex: [
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group1-sha1'
        ],
        cipher: [
          'aes128-ctr',
          'aes128-cbc',
          '3des-cbc'
        ],
        hmac: [
          'hmac-sha1',
          'hmac-sha2-256'
        ]
      }
    }
    
    fallbackClient.once('ready', () => {
      console.log(`Fallback SSH connection established successfully`)
      // Replace the original client with the fallback client
      this.client = fallbackClient
      this.setupEventHandlers()
      this.isConnected = true
      this.initializeShell()
      resolve({
        success: true,
        sessionId: this.sessionId
      })
    })
    
    fallbackClient.once('error', (err) => {
      console.error(`Fallback SSH connection also failed:`, err)
      resolve({
        success: false,
        error: this.formatErrorMessage(err)
      })
    })
    
    console.log('Trying fallback connection with basic algorithms...')
    fallbackClient.connect(fallbackConfig)
  }

  private tryAddDefaultPrivateKey(connectConfig: ConnectConfig) {
    const defaultKeyPaths = [
      join(homedir(), '.ssh', 'id_rsa'),
      join(homedir(), '.ssh', 'id_ed25519'),
      join(homedir(), '.ssh', 'id_ecdsa')
    ]

    for (const keyPath of defaultKeyPaths) {
      try {
        const privateKey = readFileSync(keyPath)
        connectConfig.privateKey = privateKey
        console.log(`Using default private key: ${keyPath}`)
        break
      } catch {
        // Ignore error and try next key
      }
    }
  }

  private formatErrorMessage(err: any): string {
    if (err.level === 'client-authentication') {
      return `Authentication failed. Please check:
• Username and password are correct
• Server allows password authentication (PasswordAuthentication yes in sshd_config)
• Account is not locked or disabled
• Try connecting with: ssh ${this.config.username}@${this.config.host} -p ${this.config.port}`
    }
    
    if (err.level === 'client-timeout') {
      return `Connection timeout. Please check:
• Server is accessible at ${this.config.host}:${this.config.port}
• Firewall allows SSH connections
• SSH service is running on the server`
    }
    
    if (err.code === 'ECONNREFUSED') {
      return `Connection refused. Please check:
• SSH service is running: sudo systemctl status sshd
• Correct port (${this.config.port}) is being used
• Server firewall allows connections`
    }
    
    if (err.code === 'ENOTFOUND' || err.code === 'EAI_NODATA') {
      return `Cannot resolve hostname ${this.config.host}. Please check:
• IP address or hostname is correct
• DNS resolution is working
• Network connectivity`
    }
    
    // Handle algorithm negotiation errors
    if (err.message && err.message.includes('Unsupported algorithm')) {
      return `SSH algorithm negotiation failed: ${err.message}
This usually happens with older or restricted SSH servers. Please check:
• Server SSH configuration allows compatible encryption algorithms
• Server is not using very old or very new SSH versions
• Try connecting with standard SSH client: ssh ${this.config.username}@${this.config.host} -p ${this.config.port}`
    }
    
    return err.message || 'Unknown SSH error occurred'
  }

  writeToShell(data: string): boolean {
    if (!this.isConnected || !this.shellReady || !this.shell) {
      return false
    }

    try {
      this.shell.write(data)
      return true
    } catch (error) {
      console.error('Error writing to shell:', error)
      return false
    }
  }

  resizeTerminal(cols: number, rows: number): boolean {
    if (!this.isConnected || !this.shellReady || !this.shell) {
      return false
    }

    try {
      this.shell.setWindow(rows, cols, 0, 0)
      return true
    } catch (error) {
      console.error('Error resizing terminal:', error)
      return false
    }
  }

  disconnect() {
    if (this.shell) {
      this.shell.end()
    }
    if (this.client) {
      this.client.end()
    }
    this.isConnected = false
    this.shellReady = false
  }

  getSessionId(): string {
    return this.sessionId
  }

  isConnectionActive(): boolean {
    return this.isConnected && this.shellReady
  }
}

export class SSHService {
  private connections: Map<string, SSHConnection> = new Map()

  // Méthode pour tester la connectivité avant de créer une vraie connexion
  async testConnection(config: SSHConnectionConfig): Promise<{ 
    reachable: boolean, 
    authMethods: string[], 
    error?: string 
  }> {
    return new Promise((resolve) => {
      const testClient = new Client()
      
      testClient.on('ready', () => {
        testClient.end()
        resolve({ 
          reachable: true, 
          authMethods: ['connection-successful'] 
        })
      })

      testClient.on('error', (err: any) => {
        // Analyser l'erreur pour donner des informations utiles
        if (err.level === 'client-authentication') {
          resolve({ 
            reachable: true, 
            authMethods: [], 
            error: 'Server reachable but authentication failed' 
          })
        } else {
          resolve({ 
            reachable: false, 
            authMethods: [], 
            error: err.message 
          })
        }
      })

      // Test de connexion basique avec timeout court
      testClient.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: 'test', // Mot de passe factice pour tester la connectivité
        readyTimeout: 10000
      })
    })
  }

  async createConnection(config: SSHConnectionConfig): Promise<SSHConnectionResult> {
    const sessionId = `ssh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const connection = new SSHConnection(sessionId, config)
      const result = await connection.connect()
      
      if (result.success) {
        this.connections.set(sessionId, connection)
        
        // Clean up connection when it ends
        connection.on('end', () => {
          this.connections.delete(sessionId)
        })
        
        connection.on('close', () => {
          this.connections.delete(sessionId)
        })
      }
      
      return result
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Unknown error occurred'
      }
    }
  }

  writeToSession(sessionId: string, data: string): boolean {
    const connection = this.connections.get(sessionId)
    if (!connection) {
      return false
    }

    return connection.writeToShell(data)
  }

  resizeSession(sessionId: string, cols: number, rows: number): boolean {
    const connection = this.connections.get(sessionId)
    if (!connection) {
      return false
    }

    return connection.resizeTerminal(cols, rows)
  }

  onSessionData(sessionId: string, callback: (data: string) => void): boolean {
    const connection = this.connections.get(sessionId)
    if (!connection) {
      return false
    }

    connection.on('data', callback)
    return true
  }

  offSessionData(sessionId: string, callback: (data: string) => void): boolean {
    const connection = this.connections.get(sessionId)
    if (!connection) {
      return false
    }

    connection.off('data', callback)
    return true
  }

  disconnectSession(sessionId: string): boolean {
    const connection = this.connections.get(sessionId)
    if (connection) {
      connection.disconnect()
      this.connections.delete(sessionId)
      return true
    }
    return false
  }

  getConnection(sessionId: string): SSHConnection | undefined {
    return this.connections.get(sessionId)
  }

  getAllSessions(): string[] {
    return Array.from(this.connections.keys())
  }

  /**
   * Exécuter une commande SSH et retourner le résultat
   */
  async executeCommand(sessionId: string, command: string): Promise<SSHCommandResult> {
    return new Promise((resolve) => {
      const connection = this.connections.get(sessionId)
      if (!connection || !connection.isConnectionActive()) {
        resolve({
          success: false,
          error: 'No active SSH connection found'
        })
        return
      }

      // Utiliser exec pour exécuter une commande unique
      const client = (connection as any).client
      client.exec(command, (err: any, stream: any) => {
        if (err) {
          resolve({
            success: false,
            error: err.message
          })
          return
        }

        let output = ''
        let errorOutput = ''

        stream.on('close', (code: number) => {
          if (code === 0) {
            resolve({
              success: true,
              output: output
            })
          } else {
            resolve({
              success: false,
              error: errorOutput || `Command exited with code ${code}`,
              output: output
            })
          }
        })

        stream.on('data', (data: Buffer) => {
          output += data.toString()
        })

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString()
        })

        // Set timeout pour éviter les commandes qui traînent
        setTimeout(() => {
          stream.close()
          if (!stream.destroyed) {
            resolve({
              success: false,
              error: 'Command timeout'
            })
          }
        }, 30000) // 30 secondes timeout
      })
    })
  }

  /**
   * Télécharger un fichier via SFTP
   */
  async downloadFile(sessionId: string, remotePath: string, localPath?: string): Promise<SSHCommandResult> {
    return new Promise((resolve) => {
      const connection = this.connections.get(sessionId)
      if (!connection || !connection.isConnectionActive()) {
        resolve({
          success: false,
          error: 'No active SSH connection found'
        })
        return
      }

      const client = (connection as any).client
      client.sftp((err: any, sftp: any) => {
        if (err) {
          resolve({
            success: false,
            error: `SFTP error: ${err.message}`
          })
          return
        }

        // Si pas de chemin local spécifié, utiliser le dossier de téléchargements
        const finalLocalPath = localPath || require('path').join(require('os').homedir(), 'Downloads', require('path').basename(remotePath))

        sftp.fastGet(remotePath, finalLocalPath, (err: any) => {
          sftp.end()
          if (err) {
            resolve({
              success: false,
              error: `Download failed: ${err.message}`
            })
          } else {
            resolve({
              success: true,
              output: `File downloaded to ${finalLocalPath}`
            })
          }
        })
      })
    })
  }

  /**
   * Téléverser un fichier via SFTP
   */
  async uploadFile(sessionId: string, localPath: string, remotePath: string): Promise<SSHCommandResult> {
    return new Promise((resolve) => {
      const connection = this.connections.get(sessionId)
      if (!connection || !connection.isConnectionActive()) {
        resolve({
          success: false,
          error: 'No active SSH connection found'
        })
        return
      }

      const client = (connection as any).client
      client.sftp((err: any, sftp: any) => {
        if (err) {
          resolve({
            success: false,
            error: `SFTP error: ${err.message}`
          })
          return
        }

        sftp.fastPut(localPath, remotePath, (err: any) => {
          sftp.end()
          if (err) {
            resolve({
              success: false,
              error: `Upload failed: ${err.message}`
            })
          } else {
            resolve({
              success: true,
              output: `File uploaded to ${remotePath}`
            })
          }
        })
      })
    })
  }

  disconnectAll() {
    for (const connection of this.connections.values()) {
      connection.disconnect()
    }
    this.connections.clear()
  }
}

export const sshService = new SSHService() 