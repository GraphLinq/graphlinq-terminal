// Plugin System Type Definitions
export interface PluginManifest {
  // Required fields
  name: string
  version: string
  displayName: string
  description: string
  author: string
  entry: string
  permissions: Permission[]
  category: string

  // Optional fields
  icon?: string
  homepage?: string
  repository?: string
  dependencies?: string[]
  minAppVersion?: string
  maxAppVersion?: string
  keywords?: string[]
  license?: string
}

export type Permission = 
  | 'terminal.execute'      // Execute terminal commands
  | 'terminal.read'         // Read terminal output
  | 'filesystem.read'       // Read files
  | 'filesystem.write'      // Write files
  | 'network.request'       // Make HTTP requests
  | 'ui.sidebar'           // Add sidebar panels
  | 'ui.modal'             // Show modal dialogs
  | 'ui.notification'      // Show notifications
  | 'storage.local'        // Local storage access
  | 'system.clipboard'     // Clipboard access

export interface ExecuteOptions {
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  command: string
}

export interface SessionInfo {
  id: string
  host: string
  port: number
  username: string
  isConnected: boolean
  currentDirectory: string
}

export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: Date
  permissions: string
}

export interface FileStats {
  size: number
  isFile: boolean
  isDirectory: boolean
  modified: Date
  created: Date
  permissions: string
}

export interface FileEvent {
  type: 'created' | 'modified' | 'deleted'
  path: string
  stats?: FileStats
}

export interface SidebarPanelConfig {
  id: string
  title: string
  icon?: string
  component: React.ComponentType<any>
  position?: number
}

export interface ContextMenuConfig {
  id: string
  label: string
  icon?: string
  action: (context: any) => void
  condition?: (context: any) => boolean
}

export interface ToolbarButtonConfig {
  id: string
  label: string
  icon?: string
  action: () => void
  position?: number
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  arch: string
}

// Plugin APIs
export interface TerminalAPI {
  execute(command: string, options?: ExecuteOptions): Promise<CommandResult>
  executeStream(command: string, onData: (data: string) => void): Promise<void>
  getCurrentSession(): SessionInfo | null
  onOutput(callback: (data: string) => void): void
  onError(callback: (error: string) => void): void
  onSessionChange(callback: (session: SessionInfo) => void): void
}

export interface UIAPI {
  addSidebarPanel(config: SidebarPanelConfig): string
  removeSidebarPanel(panelId: string): void
  showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void
  openModal(component: React.ComponentType, props?: any): Promise<any>
  addContextMenuItem(config: ContextMenuConfig): string
  addToolbarButton(config: ToolbarButtonConfig): string
}

export interface FileSystemAPI {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listDirectory(path: string): Promise<FileInfo[]>
  exists(path: string): Promise<boolean>
  getStats(path: string): Promise<FileStats>
  watchFile(path: string, callback: (event: FileEvent) => void): string
}

export interface EventAPI {
  on(event: string, callback: Function): void
  emit(event: string, data?: any): void
  off(event: string, callback: Function): void
  once(event: string, callback: Function): void
}

export interface StorageAPI {
  get(key: string): Promise<any>
  set(key: string, value: any): Promise<void>
  remove(key: string): Promise<void>
  clear(): Promise<void>
  keys(): Promise<string[]>
}

export interface PluginSDK {
  terminal: TerminalAPI
  ui: UIAPI
  filesystem: FileSystemAPI
  events: EventAPI
  storage: StorageAPI
  getPluginInfo(): PluginManifest
  getAppVersion(): string
  getAppInfo(): AppInfo
}

export interface Plugin {
  manifest: PluginManifest
  onLoad?(sdk: PluginSDK): Promise<void> | void
  onUnload?(): Promise<void> | void
  onServerConnect?(serverInfo: SessionInfo): Promise<void> | void
  onServerDisconnect?(): Promise<void> | void
  components?: {
    SidebarPanel?: React.ComponentType<any>
    ContextMenu?: React.ComponentType<any>
    Modal?: React.ComponentType<any>
    ToolbarButton?: React.ComponentType<any>
  }
  commands?: {
    [commandName: string]: (args: any[], sdk: PluginSDK) => Promise<any>
  }
}

export interface LoadedPlugin {
  id: string
  manifest: PluginManifest
  plugin: Plugin
  enabled: boolean
  loadedAt: Date
  error?: string
  sdk: PluginSDK
}

export interface PluginInstallProgress {
  stage: 'downloading' | 'extracting' | 'validating' | 'installing' | 'complete' | 'error'
  progress: number
  message: string
  error?: string
} 