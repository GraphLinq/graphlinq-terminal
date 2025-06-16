import { PluginManifest, Permission } from '../types/plugin'

export class PluginSecurityService {
  private static instance: PluginSecurityService
  private readonly MAX_PLUGIN_SIZE = 50 * 1024 * 1024 // 50MB
  private readonly REQUIRED_MANIFEST_FIELDS = [
    'name', 'version', 'displayName', 'description', 
    'author', 'entry', 'permissions', 'category'
  ]

  static getInstance(): PluginSecurityService {
    if (!PluginSecurityService.instance) {
      PluginSecurityService.instance = new PluginSecurityService()
    }
    return PluginSecurityService.instance
  }

  /**
   * Validate plugin manifest structure and content
   */
  validateManifest(manifest: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check if manifest is an object
    if (!manifest || typeof manifest !== 'object') {
      errors.push('Manifest must be a valid JSON object')
      return { valid: false, errors }
    }

    // Check required fields
    for (const field of this.REQUIRED_MANIFEST_FIELDS) {
      if (!manifest[field]) {
        errors.push(`Missing required field: ${field}`)
      }
    }

    // Validate specific fields
    if (manifest.name && !/^[a-z0-9-_]+$/.test(manifest.name)) {
      errors.push('Plugin name must contain only lowercase letters, numbers, hyphens, and underscores')
    }

    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Version must follow semantic versioning (e.g., 1.0.0)')
    }

    if (manifest.permissions && !Array.isArray(manifest.permissions)) {
      errors.push('Permissions must be an array')
    } else if (manifest.permissions) {
      const invalidPermissions = manifest.permissions.filter(
        (perm: string) => !this.isValidPermission(perm)
      )
      if (invalidPermissions.length > 0) {
        errors.push(`Invalid permissions: ${invalidPermissions.join(', ')}`)
      }
    }

    if (manifest.category && typeof manifest.category !== 'string') {
      errors.push('Category must be a string')
    }

    if (manifest.entry && typeof manifest.entry !== 'string') {
      errors.push('Entry point must be a string')
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Check if a permission is valid
   */
  private isValidPermission(permission: string): boolean {
    const validPermissions: Permission[] = [
      'terminal.execute',
      'terminal.read',
      'filesystem.read',
      'filesystem.write',
      'network.request',
      'ui.sidebar',
      'ui.modal',
      'ui.notification',
      'storage.local',
      'system.clipboard'
    ]
    return validPermissions.includes(permission as Permission)
  }

  /**
   * Check if plugin has specific permission
   */
  hasPermission(manifest: PluginManifest, permission: Permission): boolean {
    return manifest.permissions.includes(permission)
  }

  /**
   * Validate plugin file structure
   */
  async validatePluginStructure(pluginPath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    try {
      console.log(`Validating plugin structure for: ${pluginPath}`)
      
      // Check if ElectronAPI is available
      if (!window.electronAPI?.fileExists) {
        errors.push('File system API not available')
        return { valid: false, errors }
      }

      // Check if plugin directory exists
      const exists = await window.electronAPI.fileExists(pluginPath)
      if (!exists) {
        errors.push('Plugin directory does not exist')
        return { valid: false, errors }
      }

      // Check for manifest.json
      const manifestPath = `${pluginPath}/manifest.json`
      const manifestExists = await window.electronAPI.fileExists(manifestPath)
      if (!manifestExists) {
        errors.push('manifest.json not found')
        return { valid: false, errors }
      }

      // Read and validate manifest
      if (!window.electronAPI?.readFile) {
        errors.push('File read API not available')
        return { valid: false, errors }
      }

      const manifestContent = await window.electronAPI.readFile(manifestPath)
      let manifest: any
      try {
        manifest = JSON.parse(manifestContent)
      } catch (e) {
        errors.push('Invalid JSON in manifest.json')
        return { valid: false, errors }
      }

      const manifestValidation = this.validateManifest(manifest)
      if (!manifestValidation.valid) {
        errors.push(...manifestValidation.errors)
      }

      // Check for entry point file
      if (manifest.entry) {
        const entryPath = `${pluginPath}/${manifest.entry}`
        const entryExists = await window.electronAPI.fileExists(entryPath)
        if (!entryExists) {
          errors.push(`Entry point file not found: ${manifest.entry}`)
        }
      }

      return { valid: errors.length === 0, errors }
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { valid: false, errors }
    }
  }

  /**
   * Basic code scanning for security issues
   */
  async scanPluginCode(pluginPath: string, entryFile: string): Promise<{ safe: boolean; warnings: string[] }> {
    const warnings: string[] = []

    try {
      console.log(`Scanning plugin code for: ${pluginPath}/${entryFile}`)
      
      if (!window.electronAPI?.readFile) {
        warnings.push('Cannot scan code: File system API not available')
        return { safe: false, warnings }
      }

      const entryPath = `${pluginPath}/${entryFile}`
      const code = await window.electronAPI.readFile(entryPath)

      // Check for potentially dangerous patterns
      const dangerousPatterns = [
        { pattern: /eval\s*\(/g, message: 'Use of eval() detected' },
        { pattern: /Function\s*\(/g, message: 'Use of Function constructor detected' },
        { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/g, message: 'Direct child_process usage detected' },
        { pattern: /require\s*\(\s*['"`]fs['"`]\s*\)/g, message: 'Direct fs module usage detected' },
        { pattern: /process\.exit/g, message: 'Use of process.exit detected' },
        { pattern: /\.innerHTML\s*=/g, message: 'Direct innerHTML assignment detected' },
        { pattern: /document\.write/g, message: 'Use of document.write detected' }
      ]

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(code)) {
          warnings.push(message)
        }
      }

      // Check for excessive file size
      if (code.length > 1024 * 1024) { // 1MB
        warnings.push('Plugin code is very large (>1MB)')
      }

      return { safe: warnings.length === 0, warnings }
    } catch (error) {
      warnings.push(`Code scanning error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { safe: false, warnings }
    }
  }

  /**
   * Check plugin size limits
   */
  async checkPluginSize(pluginPath: string): Promise<{ valid: boolean; size: number; error?: string }> {
    try {
      console.log(`Checking plugin size for: ${pluginPath}`)
      
      if (!window.electronAPI?.getDirectorySize) {
        return {
          valid: false,
          size: 0,
          error: 'Directory size API not available'
        }
      }

      const size = await window.electronAPI.getDirectorySize(pluginPath)
      
      if (size > this.MAX_PLUGIN_SIZE) {
        return {
          valid: false,
          size,
          error: `Plugin size (${this.formatBytes(size)}) exceeds maximum allowed size (${this.formatBytes(this.MAX_PLUGIN_SIZE)})`
        }
      }

      return { valid: true, size }
    } catch (error) {
      return {
        valid: false,
        size: 0,
        error: `Size check error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Sanitize plugin name for file system
   */
  sanitizePluginName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
  }

  /**
   * Check if plugin name conflicts with existing plugins
   */
  checkNameConflict(name: string, existingPlugins: string[]): boolean {
    const sanitizedName = this.sanitizePluginName(name)
    return existingPlugins.some(existing => 
      this.sanitizePluginName(existing) === sanitizedName
    )
  }

  /**
   * Validate app version compatibility
   */
  checkVersionCompatibility(
    manifest: PluginManifest, 
    appVersion: string
  ): { compatible: boolean; reason?: string } {
    try {
      if (manifest.minAppVersion) {
        if (this.compareVersions(appVersion, manifest.minAppVersion) < 0) {
          return { 
            compatible: false, 
            reason: `Requires app version ${manifest.minAppVersion} or higher (current: ${appVersion})` 
          }
        }
      }

      if (manifest.maxAppVersion) {
        if (this.compareVersions(appVersion, manifest.maxAppVersion) > 0) {
          return { 
            compatible: false, 
            reason: `Not compatible with app version ${appVersion} (max supported: ${manifest.maxAppVersion})` 
          }
        }
      }

      return { compatible: true }
    } catch (error) {
      return { 
        compatible: false, 
        reason: `Version compatibility check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0
      
      if (v1Part > v2Part) return 1
      if (v1Part < v2Part) return -1
    }
    
    return 0
  }
}

export const pluginSecurity = PluginSecurityService.getInstance() 