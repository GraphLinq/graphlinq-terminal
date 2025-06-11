export interface ElectronAPI {
  getVersion: () => string
  getPlatform: () => Promise<string>
  sendMessage: (message: string) => Promise<string>
  onMessage: (callback: (message: string) => void) => void
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  removeAllListeners: (channel: string) => void
  loadServers: () => Promise<any[]>
  saveServers: (servers: any[]) => Promise<boolean>
  getServersFilePath: () => Promise<string>
  openDevTools: () => Promise<void>
  
  // Clipboard operations
  clipboardReadText: () => Promise<string>
  clipboardWriteText: (text: string) => Promise<boolean>
  
  // SSH methods
  sshConnect: (config: any) => Promise<any>
  sshDisconnect: (sessionId: string) => Promise<void>
  sshWrite: (sessionId: string, data: string) => Promise<void>
  sshResize: (sessionId: string, cols: number, rows: number) => Promise<void>
  onSSHData: (callback: (sessionId: string, data: string) => void) => void
  offSSHData: () => void
  sshGetSessions: () => Promise<any>
  
  // SSH file system operations
  sshExecuteCommand: (sessionId: string, command: string) => Promise<{success: boolean, output?: string, error?: string}>
  sshDownloadFile: (sessionId: string, remotePath: string, localPath?: string) => Promise<{success: boolean, error?: string}>
  sshUploadFile: (sessionId: string, localPath: string, remotePath: string) => Promise<{success: boolean, error?: string}>
  
  // Terminal options
  saveTerminalOptions: (options: any) => Promise<void>
  getTerminalOptions: () => Promise<any>
  
  // External links
  openExternal: (url: string) => Promise<void>
  
  // Directory selection
  selectDirectory: () => Promise<{canceled: boolean, path?: string}>
  
  // File selection for upload
  selectFilesForUpload: () => Promise<{canceled: boolean, filePaths: string[]}>
  
  // SSH Key generation
  generateSSHKey: (config: any) => Promise<{success: boolean, privateKey?: string, publicKey?: string, fingerprint?: string, error?: string}>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {} 