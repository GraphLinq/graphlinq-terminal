# GraphLinq Terminal Plugin System - PRD (Phase 1)

## Product Requirements Document
**Version:** 1.0  
**Date:** December 2024  
**Project:** GraphLinq Terminal Plugin Architecture  
**Phase:** 1 - Core Plugin System Implementation

---

## 1. Executive Summary

This PRD outlines the implementation of a comprehensive plugin system for the GraphLinq Terminal application. The system will allow third-party developers to extend terminal functionality through a standardized SDK and plugin architecture. Phase 1 focuses on establishing the core plugin infrastructure, basic APIs, and management interface.

## 2. Project Objectives

### Primary Goals
- Create a robust plugin loading and management system
- Provide essential APIs for terminal interaction and UI integration
- Implement a user-friendly plugin management interface
- Establish security and isolation mechanisms
- Enable hot-loading and dynamic plugin management

### Success Metrics
- Plugin loading time < 500ms per plugin
- Zero crashes from plugin failures (proper isolation)
- Developer onboarding time < 30 minutes
- Support for at least 10 concurrent plugins without performance degradation

## 3. Technical Architecture

### 3.1 File Structure
```
orion/
├── plugins/                    # Plugin directory (runtime)
│   ├── docker-manager/         # Example plugin
│   │   ├── manifest.json       # Plugin metadata
│   │   ├── index.js           # Entry point
│   │   ├── components/        # React components
│   │   └── assets/           # Static assets
├── src/
│   ├── services/
│   │   ├── pluginManager.ts   # Core plugin management
│   │   ├── pluginAPI.ts       # SDK implementation
│   │   └── pluginSecurity.ts  # Security & validation
│   ├── components/
│   │   ├── PluginManager/     # Plugin management UI
│   │   └── PluginContainer/   # Plugin rendering container
└── types/
    └── plugin.d.ts           # TypeScript definitions
```

### 3.2 Core Components

#### Plugin Manager Service
- **Responsibility:** Load, unload, and manage plugin lifecycle
- **Key Methods:**
  - `loadPlugin(pluginPath: string): Promise<Plugin>`
  - `unloadPlugin(pluginId: string): void`
  - `getLoadedPlugins(): Plugin[]`
  - `validatePlugin(manifest: PluginManifest): boolean`

#### Plugin API Service
- **Responsibility:** Provide standardized APIs to plugins
- **Key APIs:**
  - Terminal API (execute commands, read output)
  - UI API (register components, show notifications)
  - File System API (read/write files, navigate directories)
  - Event API (listen/emit events)
  - Storage API (persistent plugin data)

#### Plugin Security Service
- **Responsibility:** Validate and isolate plugins
- **Key Features:**
  - Manifest validation
  - Permission checking
  - Resource monitoring
  - Error boundary implementation

## 4. Plugin Manifest Specification

### 4.1 Required Fields
```json
{
  "name": "string",              // Unique plugin identifier
  "version": "string",           // Semantic version
  "displayName": "string",       // Human-readable name
  "description": "string",       // Plugin description
  "author": "string",           // Author information
  "entry": "string",            // Entry point file
  "permissions": ["string[]"],   // Required permissions
  "category": "string"          // Plugin category
}
```

### 4.2 Optional Fields
```json
{
  "icon": "string",             // Icon file path
  "homepage": "string",         // Plugin homepage URL
  "repository": "string",       // Source code repository
  "dependencies": ["string[]"], // Plugin dependencies
  "minAppVersion": "string",    // Minimum app version
  "maxAppVersion": "string",    // Maximum app version
  "keywords": ["string[]"],     // Search keywords
  "license": "string"          // License type
}
```

## 5. Plugin API Specification

### 5.1 Terminal API
```typescript
interface TerminalAPI {
  // Execute commands
  execute(command: string, options?: ExecuteOptions): Promise<CommandResult>
  
  // Stream command output
  executeStream(command: string, onData: (data: string) => void): Promise<void>
  
  // Get current session info
  getCurrentSession(): SessionInfo | null
  
  // Listen to terminal events
  onOutput(callback: (data: string) => void): void
  onError(callback: (error: string) => void): void
  onSessionChange(callback: (session: SessionInfo) => void): void
}
```

### 5.2 UI API
```typescript
interface UIAPI {
  // Register sidebar panel
  addSidebarPanel(config: SidebarPanelConfig): string
  
  // Remove sidebar panel
  removeSidebarPanel(panelId: string): void
  
  // Show notifications
  showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void
  
  // Open modal dialog
  openModal(component: React.ComponentType, props?: any): Promise<any>
  
  // Add context menu items
  addContextMenuItem(config: ContextMenuConfig): string
  
  // Add toolbar button
  addToolbarButton(config: ToolbarButtonConfig): string
}
```

### 5.3 File System API
```typescript
interface FileSystemAPI {
  // Read file content
  readFile(path: string): Promise<string>
  
  // Write file content
  writeFile(path: string, content: string): Promise<void>
  
  // List directory contents
  listDirectory(path: string): Promise<FileInfo[]>
  
  // Check file/directory existence
  exists(path: string): Promise<boolean>
  
  // Get file stats
  getStats(path: string): Promise<FileStats>
  
  // Watch file changes
  watchFile(path: string, callback: (event: FileEvent) => void): string
}
```

### 5.4 Event API
```typescript
interface EventAPI {
  // Listen to events
  on(event: string, callback: Function): void
  
  // Emit events
  emit(event: string, data?: any): void
  
  // Remove event listener
  off(event: string, callback: Function): void
  
  // Listen once
  once(event: string, callback: Function): void
}
```

### 5.5 Storage API
```typescript
interface StorageAPI {
  // Get stored value
  get(key: string): Promise<any>
  
  // Set stored value
  set(key: string, value: any): Promise<void>
  
  // Remove stored value
  remove(key: string): Promise<void>
  
  // Clear all stored values
  clear(): Promise<void>
  
  // Get all keys
  keys(): Promise<string[]>
}
```

## 6. Plugin Interface Specification

### 6.1 Plugin Entry Point
```typescript
interface Plugin {
  // Plugin metadata
  manifest: PluginManifest
  
  // Lifecycle hooks
  onLoad?(sdk: PluginSDK): Promise<void> | void
  onUnload?(): Promise<void> | void
  onServerConnect?(serverInfo: ServerInfo): Promise<void> | void
  onServerDisconnect?(): Promise<void> | void
  
  // UI components (optional)
  components?: {
    SidebarPanel?: React.ComponentType<any>
    ContextMenu?: React.ComponentType<any>
    Modal?: React.ComponentType<any>
    ToolbarButton?: React.ComponentType<any>
  }
  
  // Custom commands (optional)
  commands?: {
    [commandName: string]: (args: any[], sdk: PluginSDK) => Promise<any>
  }
}
```

### 6.2 Plugin SDK
```typescript
interface PluginSDK {
  terminal: TerminalAPI
  ui: UIAPI
  filesystem: FileSystemAPI
  events: EventAPI
  storage: StorageAPI
  
  // Plugin info
  getPluginInfo(): PluginManifest
  
  // App info
  getAppVersion(): string
  getAppInfo(): AppInfo
}
```

## 7. Plugin Management Interface

### 7.1 Plugin Manager Component
**Location:** Accessible from main menu → "Plugin Manager"

**Features:**
- List all installed plugins with status (enabled/disabled)
- Install new plugins (drag & drop, file upload, URL)
- Enable/disable plugins without uninstalling
- Uninstall plugins
- View plugin details and permissions
- Check for plugin updates
- Plugin settings/configuration

### 7.2 Plugin Manager UI Sections

#### 7.2.1 Plugin List View
- **Grid/List toggle:** Switch between grid and list view
- **Search/Filter:** Search by name, category, or keywords
- **Sort options:** By name, category, install date, last updated
- **Status indicators:** Enabled, disabled, error, updating

#### 7.2.2 Plugin Details Panel
- **Basic info:** Name, version, author, description
- **Permissions:** List of required permissions
- **Dependencies:** Required plugins or app versions
- **Statistics:** Usage stats, performance metrics
- **Actions:** Enable/disable, uninstall, configure

#### 7.2.3 Plugin Installation
- **Drag & Drop zone:** Drop plugin folders or ZIP files
- **File picker:** Browse and select plugin files
- **URL installer:** Install from GitHub or other URLs
- **Progress indicator:** Installation progress and status

## 8. Security & Permissions

### 8.1 Permission System
```typescript
type Permission = 
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
```

### 8.2 Validation Rules
- **Manifest validation:** Required fields, valid JSON structure
- **File validation:** Entry point exists, valid JavaScript
- **Permission validation:** Only request necessary permissions
- **Size limits:** Maximum plugin size (50MB)
- **Code scanning:** Basic security checks (no eval, limited Node.js APIs)

## 9. Error Handling & Isolation

### 9.1 Error Boundaries
- Each plugin runs in its own error boundary
- Plugin errors don't crash the main application
- Error reporting and logging for debugging
- Graceful degradation when plugins fail

### 9.2 Resource Management
- Memory usage monitoring per plugin
- CPU usage limits for plugin operations
- Automatic cleanup on plugin unload
- Garbage collection for unused plugin resources

## 10. Implementation Tasks

### 10.1 Core Infrastructure (Week 1-2)
1. **Plugin Manager Service**
   - Create `PluginManager` class with loading/unloading logic
   - Implement plugin discovery and validation
   - Add plugin lifecycle management

2. **Plugin API Implementation**
   - Implement `TerminalAPI` with command execution
   - Create `UIAPI` for component registration
   - Build `FileSystemAPI` with secure file operations
   - Implement `EventAPI` for plugin communication
   - Create `StorageAPI` with isolated plugin storage

3. **Security Layer**
   - Add manifest validation
   - Implement permission checking
   - Create error boundaries for plugins
   - Add resource monitoring

### 10.2 UI Components (Week 3)
1. **Plugin Manager Interface**
   - Create main Plugin Manager component
   - Implement plugin list with grid/list views
   - Add search and filtering functionality
   - Create plugin details panel

2. **Plugin Installation**
   - Implement drag & drop installation
   - Add file picker for plugin selection
   - Create installation progress indicators
   - Add error handling for failed installations

3. **Plugin Integration**
   - Create plugin container components
   - Implement sidebar panel registration
   - Add context menu integration
   - Create notification system

### 10.3 Testing & Documentation (Week 4)
1. **Testing**
   - Unit tests for plugin manager
   - Integration tests for plugin APIs
   - Security testing for validation
   - Performance testing with multiple plugins

2. **Documentation**
   - Plugin development guide
   - API reference documentation
   - Example plugin implementations
   - Troubleshooting guide

## 11. Acceptance Criteria

### 11.1 Functional Requirements
- [ ] Plugin manager can load plugins from `/plugins` directory
- [ ] Plugins can execute terminal commands and receive output
- [ ] Plugins can register UI components (sidebar panels, context menus)
- [ ] Plugin management interface allows install/uninstall/enable/disable
- [ ] Plugin errors are isolated and don't crash the application
- [ ] Plugin permissions are validated and enforced

### 11.2 Performance Requirements
- [ ] Plugin loading time < 500ms per plugin
- [ ] No noticeable performance impact with 10+ plugins loaded
- [ ] Memory usage increase < 100MB with 10 plugins
- [ ] UI remains responsive during plugin operations

### 11.3 Security Requirements
- [ ] Plugin manifest validation prevents malformed plugins
- [ ] Permission system restricts plugin capabilities
- [ ] File system access is sandboxed to safe directories
- [ ] Network requests can be monitored and limited

## 12. Future Considerations (Phase 2+)

- **Plugin Store:** Centralized marketplace for plugin discovery
- **Plugin Updates:** Automatic update system with version management
- **Plugin Dependencies:** Support for plugin-to-plugin dependencies
- **Advanced APIs:** Database connections, SSH tunneling, custom protocols
- **Plugin Themes:** Allow plugins to provide custom themes
- **Plugin CLI:** Command-line tools for plugin development and testing

## Recent Improvements (Terminal Interference Fix)

### Problem Identified
The original plugin API was causing terminal interference issues where:
- Plugins would capture SSH output permanently
- Users couldn't type in the terminal after opening plugin interfaces
- Multiple plugins could conflict with each other's listeners

### Solution Implemented
**Temporary Listener Pattern**: Inspired by the AI Assistant implementation, the plugin API now uses:

1. **Scoped Command Execution**: Each plugin command execution creates a temporary listener
2. **Automatic Cleanup**: Listeners are automatically removed after command completion
3. **Timeout Management**: Commands have configurable timeouts with proper cleanup
4. **Prompt Detection**: Smart detection of command completion using prompt patterns
5. **Non-Blocking**: Plugin operations don't interfere with normal terminal usage

### Key Changes Made

#### PluginAPI Service (`src/renderer/src/services/pluginAPI.ts`)
- **Enhanced `terminal.execute()`**: Now uses temporary listeners like AI service
- **Improved `terminal.executeStream()`**: Proper cleanup and timeout handling
- **Smart Output Parsing**: Detects command completion using multiple prompt patterns
- **Error Handling**: Better error messages and cleanup on failures

#### Docker Manager Plugin (`plugins/docker-manager/index.js`)
- **Updated Command Execution**: Uses new API with proper timeout configuration
- **Improved Error Handling**: Shows detailed error messages from command results
- **Better Output Parsing**: Uses Docker's `--format` option for consistent parsing
- **Non-Blocking Operations**: Plugin actions don't interfere with terminal input

### Technical Implementation

```javascript
// Before (Problematic)
window.electronAPI.onSSHData(permanentListener) // Never removed!

// After (Fixed)
const temporaryListener = (sessionId, data) => { /* handle data */ }
window.electronAPI.onSSHData(temporaryListener)
// ... command execution ...
window.electronAPI.offSSHData() // Properly cleaned up
```

### Benefits
1. **No Terminal Interference**: Users can type normally while plugins are active
2. **Better Resource Management**: No memory leaks from permanent listeners
3. **Improved Reliability**: Commands complete properly with timeout handling
4. **Enhanced User Experience**: Plugin operations are transparent to users
5. **Scalable Architecture**: Multiple plugins can coexist without conflicts
6. **Connection Stability**: Plugins wait for SSH sessions to stabilize before executing commands

### Connection Timing Improvements

**Problem**: Plugins were trying to execute commands immediately after SSH connection, causing timeouts because the session wasn't fully established.

**Solution**: Added progressive delays:
- **App Level**: 2-second delay before notifying plugins of server connection
- **Plugin Level**: Additional 1-second delay before checking service availability
- **Existing Sessions**: 1.5-second delay when plugin loads with active session
- **Robust Detection**: Multiple fallback methods for service detection

```javascript
// App.tsx - Delayed plugin notification
setTimeout(async () => {
  await pluginManager.onServerConnect(sessionInfo)
}, 2000)

// Plugin - Additional stabilization delay
setTimeout(async () => {
  await this.checkDockerAvailability(this.sdk)
}, 1000)
```

### Performance Optimizations

**Problem**: Fast commands (like `docker ps`) were waiting for full timeout instead of detecting immediate completion.

**Solution**: Multi-level command completion detection:
- **Immediate Detection**: 10ms response for obvious prompt patterns in real-time data
- **Quick Detection**: 30ms response for fast commands with clear output
- **Standard Detection**: 50ms response for normal prompt patterns  
- **Inactivity Timeout**: Reduced from 10s to 3s for faster fallback

```javascript
// Ultra-fast detection for immediate prompts
if (lastRecentLine.match(/[@#$>]\s*$/)) {
  setTimeout(() => resolve(cleanOutput()), 10)
}

// Quick detection for fast commands
if (lastLine.match(/[@#$>]\s*$/) && lines.length > 2) {
  setTimeout(() => resolve(cleanOutput()), 30)
}
```

**Result**: Docker commands now complete in ~100-500ms instead of 3-10 seconds!

### Terminal Interference Fix

**Problem**: After plugin command execution, users couldn't type in the terminal anymore because `offSSHData()` was removing ALL SSH listeners.

**Root Cause**: The plugin API was calling `window.electronAPI.offSSHData()` which removes all SSH data listeners, including those needed for normal terminal operation.

**Solution**: Remove `offSSHData()` calls and use only the `isListening` flag pattern:

```javascript
// Before (Problematic)
const cleanup = () => {
  isListening = false
  window.electronAPI.offSSHData() // ❌ Removes ALL listeners!
}

// After (Fixed)
const cleanup = () => {
  isListening = false
  // ✅ Just stop listening, don't remove other listeners
}
```

**Pattern Used**: Same as AI Service - listeners naturally filter themselves using the `isListening` flag and session ID checks.

**Result**: Terminal remains fully functional after plugin command execution!

---

**Document Status:** Draft  
**Next Review:** After Phase 1 implementation  
**Stakeholders:** Development Team, Plugin Developers, End Users 