import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example API methods - add more as needed
  getVersion: () => process.versions.electron,
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  
  // IPC communication examples
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  onMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('message-received', (event, message) => callback(message))
  },
  
  // Window controls
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  openDevTools: () => ipcRenderer.invoke('open-dev-tools'),
  
  // Clipboard operations
  clipboardReadText: () => ipcRenderer.invoke('clipboard-read-text'),
  clipboardWriteText: (text: string) => ipcRenderer.invoke('clipboard-write-text', text),
  
  // Remove listener
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },
  
  // File operations for servers
  loadServers: () => ipcRenderer.invoke('load-servers'),
  saveServers: (servers: any[]) => ipcRenderer.invoke('save-servers', servers),
  getServersFilePath: () => ipcRenderer.invoke('get-servers-file-path'),
  
  // SSH operations
  sshConnect: (config: any) => ipcRenderer.invoke('ssh-connect', config),
  sshWrite: (sessionId: string, data: string) => ipcRenderer.invoke('ssh-write', sessionId, data),
  sshResize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('ssh-resize', sessionId, cols, rows),
  sshDisconnect: (sessionId: string) => ipcRenderer.invoke('ssh-disconnect', sessionId),
  sshGetSessions: () => ipcRenderer.invoke('ssh-get-sessions'),
  
  // SSH file system operations
  sshExecuteCommand: (sessionId: string, command: string) => ipcRenderer.invoke('ssh-execute-command', sessionId, command),
  sshDownloadFile: (sessionId: string, remotePath: string, localPath?: string) => ipcRenderer.invoke('ssh-download-file', sessionId, remotePath, localPath),
  sshUploadFile: (sessionId: string, localPath: string, remotePath: string) => ipcRenderer.invoke('ssh-upload-file', sessionId, localPath, remotePath),
  
  // SSH data events
  onSSHData: (callback: (sessionId: string, data: string) => void) => {
    ipcRenderer.on('ssh-data', (event, sessionId, data) => callback(sessionId, data))
  },
  offSSHData: () => {
    ipcRenderer.removeAllListeners('ssh-data')
  },
  
  // Terminal options
  saveTerminalOptions: (options: any) => ipcRenderer.invoke('terminal:saveOptions', options),
  getTerminalOptions: () => ipcRenderer.invoke('terminal:getOptions'),
  
  // External links
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // Open servers folder
  openServersFolder: () => ipcRenderer.invoke('open-servers-folder'),
  
  // Directory selection
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // File selection for upload
  selectFilesForUpload: () => ipcRenderer.invoke('select-files-for-upload'),
  
  // SSH Key generation
  generateSSHKey: (config: any) => ipcRenderer.invoke('generate-ssh-key', config),
  
  // Plugin system file operations
  fileExists: (path: string) => ipcRenderer.invoke('plugin:file-exists', path),
  readFile: (path: string) => ipcRenderer.invoke('plugin:read-file', path),
  readDirectory: (path: string) => ipcRenderer.invoke('plugin:read-directory', path),
  getDirectorySize: (path: string) => ipcRenderer.invoke('plugin:get-directory-size', path),
  getPluginsDirectory: () => ipcRenderer.invoke('plugin:get-plugins-directory'),
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => string
      getPlatform: () => Promise<string>
      sendMessage: (message: string) => Promise<any>
      onMessage: (callback: (message: string) => void) => void
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      openDevTools: () => Promise<void>
      clipboardReadText: () => string
      clipboardWriteText: (text: string) => void
      removeAllListeners: (channel: string) => void
      loadServers: () => Promise<void>
      saveServers: (servers: any[]) => Promise<void>
      getServersFilePath: () => Promise<string>
      sshConnect: (config: any) => Promise<any>
      sshWrite: (sessionId: string, data: string) => Promise<any>
      sshResize: (sessionId: string, cols: number, rows: number) => Promise<any>
      sshDisconnect: (sessionId: string) => Promise<any>
      sshGetSessions: () => Promise<any>
      sshExecuteCommand: (sessionId: string, command: string) => Promise<any>
      sshDownloadFile: (sessionId: string, remotePath: string, localPath?: string) => Promise<any>
      sshUploadFile: (sessionId: string, localPath: string, remotePath: string) => Promise<any>
      onSSHData: (callback: (sessionId: string, data: string) => void) => void
      offSSHData: () => void
      saveTerminalOptions: (options: any) => Promise<void>
      getTerminalOptions: () => Promise<any>
      openExternal: (url: string) => Promise<void>
      openServersFolder: () => Promise<void>
      selectDirectory: () => Promise<any>
      selectFilesForUpload: () => Promise<any>
      generateSSHKey: (config: any) => Promise<any>
      fileExists: (path: string) => Promise<boolean>
      readFile: (path: string) => Promise<string>
      readDirectory: (path: string) => Promise<string[]>
      getDirectorySize: (path: string) => Promise<number>
      getPluginsDirectory: () => Promise<string>
    }
  }
} 