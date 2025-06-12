import { app, BrowserWindow, Menu, ipcMain, clipboard, shell, dialog } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import { sshService, SSHConnectionConfig } from './sshService'
import { initTerminalOptionsHandlers } from './terminalOptions'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit()
  }
} catch (error) {
  // electron-squirrel-startup is optional, ignore if not installed
}

let mainWindow: BrowserWindow

const isDev = !app.isPackaged

// Get the path for storing user data
const getUserDataPath = () => {
  return app.getPath('userData')
}

const getServersFilePath = () => {
  return join(getUserDataPath(), 'servers.json')
}

const createWindow = async (): Promise<void> => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
    backgroundMaterial: "acrylic",
    show: false,
    frame: false, // Remove native frame
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 13 } : undefined,
    minWidth: 800,
    minHeight: 600,
  })

  // Load the app
  if (isDev) {
    try {
      await mainWindow.loadURL('http://localhost:5173')
      console.log("Loaded URL")
      mainWindow.show()
      mainWindow.webContents.openDevTools()
    } catch (error) {
      console.log('Development server not ready, retrying in 1 second...')
      setTimeout(async () => {
        try {
          await mainWindow.loadURL('http://localhost:5173')
          mainWindow.webContents.openDevTools()
        } catch (retryError) {
          console.error('Failed to connect to development server:', retryError)
          // Fallback to built files if available
          try {
            mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
          } catch (fallbackError) {
            console.error('No built files available. Please run npm run build first.')
          }
        }
      }, 1000)
    }
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null as any
    // Disconnect all SSH sessions when window closes
    sshService.disconnectAll()
  })
}

// Default servers data
const defaultServers = [
  {
    id: "prod-web-01",
    name: "Web Server Production",
    host: "web-prod-01.company.com",
    port: 22,
    username: "webadmin",
    authType: "privateKey",
    privateKeyPath: "~/.ssh/prod_rsa",
    description: "Serveur web principal en production - Apache + PHP",
    category: "production",
    status: "disconnected"
  },
  {
    id: "dev-api-01",
    name: "API Development",
    host: "192.168.1.50",
    port: 2222,
    username: "developer",
    authType: "password",
    password: "",
    description: "Serveur de développement pour l'API REST",
    category: "development",
    status: "disconnected"
  },
  {
    id: "staging-db-01",
    name: "Database Staging",
    host: "staging-db.internal",
    port: 22,
    username: "dbadmin",
    authType: "privateKey",
    privateKeyPath: "~/.ssh/staging_key",
    description: "Base de données de staging - PostgreSQL 14",
    category: "staging",
    status: "disconnected"
  },
  {
    id: "test-jenkins",
    name: "Jenkins CI/CD",
    host: "jenkins.test.local",
    port: 22,
    username: "jenkins",
    authType: "privateKey",
    privateKeyPath: "~/.ssh/jenkins_rsa",
    description: "Serveur Jenkins pour l'intégration continue",
    category: "testing",
    status: "disconnected"
  },
  {
    id: "backup-server",
    name: "Backup Server",
    host: "backup.company.com",
    port: 2200,
    username: "backup",
    authType: "password",
    password: "",
    description: "Serveur de sauvegarde automatique",
    category: "default",
    status: "disconnected"
  }
]

// File operations IPC handlers
ipcMain.handle('load-servers', async () => {
  try {
    const filePath = getServersFilePath()
    
    if (!existsSync(filePath)) {
      // Create the file with default data if it doesn't exist
      await fs.writeFile(filePath, JSON.stringify(defaultServers, null, 2), 'utf8')
      console.log('Created servers.json with default data at:', filePath)
      return defaultServers
    }
    
    const data = await fs.readFile(filePath, 'utf8')
    const servers = JSON.parse(data)
    console.log('Loaded servers from:', filePath)
    return servers
  } catch (error) {
    console.error('Error loading servers:', error)
    // Return default servers if there's an error
    return defaultServers
  }
})

ipcMain.handle('save-servers', async (event, servers) => {
  try {
    const filePath = getServersFilePath()
    
    // Ensure the directory exists
    const userDataPath = getUserDataPath()
    if (!existsSync(userDataPath)) {
      await fs.mkdir(userDataPath, { recursive: true })
    }
    
    await fs.writeFile(filePath, JSON.stringify(servers, null, 2), 'utf8')
    console.log('Saved servers to:', filePath)
    return true
  } catch (error) {
    console.error('Error saving servers:', error)
    return false
  }
})

ipcMain.handle('get-servers-file-path', () => {
  return getServersFilePath()
})

// IPC handlers
ipcMain.handle('send-message', async (event, message: string) => {
  console.log('Message received from renderer:', message)
  // You can add your logic here
  return `Message received: ${message}`
})

// Window control handlers
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize()
  }
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close()
  }
})

ipcMain.handle('open-dev-tools', () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools()
  }
})

// Handlers pour le clipboard
ipcMain.handle('clipboard-read-text', () => {
  return clipboard.readText()
})

ipcMain.handle('clipboard-write-text', (event, text) => {
  clipboard.writeText(text)
  return true
})

ipcMain.handle('get-platform', () => {
  return process.platform
})

// External links handler
ipcMain.handle('open-external', async (event, url: string) => {
  try {
    await shell.openExternal(url)
  } catch (error) {
    console.error('Error opening external URL:', error)
  }
})

// Open servers folder in file explorer
ipcMain.handle('open-servers-folder', async () => {
  try {
    const filePath = getServersFilePath()
    const folderPath = join(filePath, '..')
    await shell.openPath(folderPath)
  } catch (error) {
    console.error('Error opening servers folder:', error)
  }
})

// Directory selection handler
ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Sélectionner le dossier pour sauvegarder les clés SSH'
    })
    
    return {
      canceled: result.canceled,
      path: result.canceled ? undefined : result.filePaths[0]
    }
  } catch (error) {
    console.error('Error selecting directory:', error)
    return { canceled: true }
  }
})

// File selection handler for upload
ipcMain.handle('select-files-for-upload', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      title: 'Select files to upload'
    })
    
    return {
      canceled: result.canceled,
      filePaths: result.canceled ? [] : result.filePaths
    }
  } catch (error) {
    console.error('Error selecting files:', error)
    return { canceled: true, filePaths: [] }
  }
})

// SSH Key generation handler
ipcMain.handle('generate-ssh-key', async (event, config) => {
  try {
    console.log('Generating SSH key with config:', config)
    
    const { type, bits, passphrase, comment, filename, location } = config
    
    // Create directory if it doesn't exist
    if (!existsSync(location)) {
      await fs.mkdir(location, { recursive: true })
    }
    
    const privateKeyPath = join(location, filename)
    const publicKeyPath = join(location, `${filename}.pub`)
    
    // Generate SSH key using ssh-keygen (if available) or OpenSSL
    let sshKeygenCmd = ''
    
    if (type === 'ed25519') {
      sshKeygenCmd = `ssh-keygen -t ed25519 -f "${privateKeyPath}" -C "${comment}"`
    } else if (type === 'rsa') {
      sshKeygenCmd = `ssh-keygen -t rsa -b ${bits} -f "${privateKeyPath}" -C "${comment}"`
    }
    
    // Add passphrase if provided
    if (passphrase) {
      sshKeygenCmd += ` -N "${passphrase}"`
    } else {
      sshKeygenCmd += ` -N ""`
    }
    
    try {
      // Try to use ssh-keygen first
      execSync(sshKeygenCmd, { stdio: 'pipe' })
    } catch (sshKeygenError) {
      console.log('ssh-keygen not available, using fallback method')
      
      // Fallback: Generate using Node.js crypto (simplified)
      if (type === 'ed25519') {
        return {
          success: false,
          error: 'ED25519 key generation requires ssh-keygen. Please install Git for Windows or OpenSSH.'
        }
      }
      
      // For RSA, we can use a simplified approach
      const crypto = require('crypto')
      const { generateKeyPairSync } = crypto
      
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: bits,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          cipher: passphrase ? 'aes-256-cbc' : undefined,
          passphrase: passphrase || undefined
        }
      })
      
      // Convert to OpenSSH format (simplified)
      const publicKeyOpenSSH = `ssh-rsa ${Buffer.from(publicKey).toString('base64')} ${comment}`
      
      // Save keys
      await fs.writeFile(privateKeyPath, privateKey, { mode: 0o600 })
      await fs.writeFile(publicKeyPath, publicKeyOpenSSH)
      
      // Generate fingerprint
      const hash = createHash('sha256')
      hash.update(Buffer.from(publicKey))
      const fingerprint = `SHA256:${hash.digest('base64')}`
      
      return {
        success: true,
        privateKey: privateKey,
        publicKey: publicKeyOpenSSH,
        fingerprint: fingerprint,
        privateKeyPath: privateKeyPath,
        publicKeyPath: publicKeyPath
      }
    }
    
    // If ssh-keygen succeeded, read the generated files
    const privateKeyContent = await fs.readFile(privateKeyPath, 'utf8')
    const publicKeyContent = await fs.readFile(publicKeyPath, 'utf8')
    
    // Generate fingerprint using ssh-keygen
    let fingerprint = ''
    try {
      const fingerprintCmd = `ssh-keygen -lf "${publicKeyPath}"`
      const fingerprintOutput = execSync(fingerprintCmd, { encoding: 'utf8' })
      fingerprint = fingerprintOutput.trim().split(' ')[1] // Extract the fingerprint part
    } catch (error) {
      fingerprint = 'Unable to generate fingerprint'
    }
    
    console.log('SSH key generated successfully')
    
    return {
      success: true,
      privateKey: privateKeyContent,
      publicKey: publicKeyContent.trim(),
      fingerprint: fingerprint,
      privateKeyPath: privateKeyPath,
      publicKeyPath: publicKeyPath
    }
    
  } catch (error: any) {
    console.error('SSH key generation error:', error)
    return {
      success: false,
      error: error.message || 'Unknown error occurred during key generation'
    }
  }
})

// SSH File System handlers
ipcMain.handle('ssh-execute-command', async (event, sessionId: string, command: string) => {
  try {
    console.log('Executing SSH command:', command)
    const result = await sshService.executeCommand(sessionId, command)
    console.log('SSH command result:', result)
    return result
  } catch (error: any) {
    console.error('SSH command execution error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
})

ipcMain.handle('ssh-download-file', async (event, sessionId: string, remotePath: string, localPath?: string) => {
  try {
    console.log('Downloading file:', remotePath)
    const result = await sshService.downloadFile(sessionId, remotePath, localPath)
    console.log('SSH download result:', result)
    return result
  } catch (error: any) {
    console.error('SSH download error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
})

ipcMain.handle('ssh-upload-file', async (event, sessionId: string, localPath: string, remotePath: string) => {
  try {
    console.log('Uploading file:', localPath, 'to', remotePath)
    const result = await sshService.uploadFile(sessionId, localPath, remotePath)
    console.log('SSH upload result:', result)
    return result
  } catch (error: any) {
    console.error('SSH upload error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
})

// SSH Connection handlers
ipcMain.handle('ssh-test-connection', async (event, config: SSHConnectionConfig) => {
  try {
    console.log('Testing SSH connection to:', config.host)
    const result = await sshService.testConnection(config)
    console.log('SSH test result:', result)
    return result
  } catch (error: any) {
    console.error('SSH test error:', error)
    return {
      reachable: false,
      authMethods: [],
      error: error?.message || 'Unknown error occurred'
    }
  }
})

ipcMain.handle('ssh-connect', async (event, config: SSHConnectionConfig) => {
  try {
    console.log('Attempting SSH connection to:', config.host)
    const result = await sshService.createConnection(config)
    console.log('SSH connection result:', result)
    
    if (result.success && result.sessionId) {
      // Set up data forwarding from SSH to renderer
      sshService.onSessionData(result.sessionId, (data: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ssh-data', result.sessionId, data)
        }
      })
    }
    
    return result
  } catch (error: any) {
    console.error('SSH connection error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
})

ipcMain.handle('ssh-write', async (event, sessionId: string, data: string) => {
  try {
    const success = sshService.writeToSession(sessionId, data)
    return { success }
  } catch (error: any) {
    console.error('SSH write error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
})

ipcMain.handle('ssh-resize', async (event, sessionId: string, cols: number, rows: number) => {
  try {
    const success = sshService.resizeSession(sessionId, cols, rows)
    return { success }
  } catch (error: any) {
    console.error('SSH resize error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
})

ipcMain.handle('ssh-disconnect', async (event, sessionId: string) => {
  try {
    console.log('Disconnecting SSH session:', sessionId)
    const result = sshService.disconnectSession(sessionId)
    return { success: result }
  } catch (error: any) {
    console.error('SSH disconnect error:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred'
    }
  }
})

ipcMain.handle('ssh-get-sessions', async () => {
  try {
    const sessions = sshService.getAllSessions()
    return { success: true, sessions }
  } catch (error: any) {
    console.error('Error getting SSH sessions:', error)
    return {
      success: false,
      error: error?.message || 'Unknown error occurred',
      sessions: []
    }
  }
})

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow()
  
  // Initialize terminal options handlers
  initTerminalOptionsHandlers()

  // On OS X it's common to re-create a window in the app when the dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' }
  })
})

// Set application menu to null to hide it
Menu.setApplicationMenu(null) 