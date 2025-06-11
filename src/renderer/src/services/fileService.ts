export interface FileItem {
  name: string
  type: 'file' | 'directory'
  size: number
  permissions: string
  lastModified: string
  owner: string
  group: string
  isSymlink?: boolean
  target?: string
  isHidden: boolean
}

export interface FileOperationResult {
  success: boolean
  error?: string
  data?: any
}

export class FileService {
  /**
   * Lister les fichiers d'un répertoire via SSH
   */
  static async listFiles(sessionId: string, path: string): Promise<FileItem[]> {
    try {
      console.log('FileService.listFiles appelé avec:', { sessionId, path })
      
      // Utiliser la vraie commande SSH
      if (window.electronAPI?.sshExecuteCommand) {
        // Utiliser la commande 'ls' avec les options pour obtenir les détails
        const command = `ls -la "${path}"`
        console.log('Exécution de la commande SSH:', command)
        const result = await window.electronAPI.sshExecuteCommand(sessionId, command)
        
        console.log('Résultat SSH:', result)
        
        if (result.success && result.output) {
          const parsedFiles = this.parseListOutput(result.output, path)
          console.log('Fichiers parsés:', parsedFiles)
          return parsedFiles
        } else {
          console.error('Erreur SSH:', result.error)
          throw new Error(result.error || 'Erreur lors de l\'exécution de la commande SSH')
        }
      }
      
      // Si pas d'API SSH disponible, lever une erreur
      throw new Error('API SSH non disponible - assurez-vous d\'être connecté')
    } catch (error) {
      console.error('Erreur lors de la liste des fichiers:', error)
      throw error
    }
  }

  /**
   * Parser la sortie de la commande ls
   */
  private static parseListOutput(output: string, currentPath: string): FileItem[] {
    const lines = output.trim().split('\n')
    const files: FileItem[] = []
    
    // Ignorer la première ligne qui contient le total
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      
      // Parser une ligne de ls -la
      // Format: permissions links owner group size date time name
      const parts = line.split(/\s+/)
      if (parts.length < 9) continue
      
      const permissions = parts[0]
      const owner = parts[2]
      const group = parts[3]
      const size = parseInt(parts[4]) || 0
      const date = parts[5]
      const time = parts[6]
      const name = parts.slice(8).join(' ')
      
      // Ignorer . et ..
      if (name === '.' || name === '..') continue
      
      const isDirectory = permissions.startsWith('d')
      const isSymlink = permissions.startsWith('l')
      const isHidden = name.startsWith('.')
      
      let target: string | undefined
      if (isSymlink && name.includes(' -> ')) {
        const [actualName, linkTarget] = name.split(' -> ')
        target = linkTarget
      }
      
      files.push({
        name: isSymlink && name.includes(' -> ') ? name.split(' -> ')[0] : name,
        type: isDirectory ? 'directory' : 'file',
        size,
        permissions,
        lastModified: `${date}T${time}Z`,
        owner,
        group,
        isSymlink,
        target,
        isHidden
      })
    }
    
    return files
  }

  /**
   * Télécharger un fichier
   */
  static async downloadFile(sessionId: string, remotePath: string, localPath?: string): Promise<FileOperationResult> {
    try {
      if (window.electronAPI?.sshDownloadFile) {
        const result = await window.electronAPI.sshDownloadFile(sessionId, remotePath, localPath)
        return { success: result.success, error: result.error }
      }
      
      return { success: false, error: 'SSH download API not available' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Téléverser un fichier
   */
  static async uploadFile(sessionId: string, localPath: string, remotePath: string): Promise<FileOperationResult> {
    try {
      if (window.electronAPI?.sshUploadFile) {
        const result = await window.electronAPI.sshUploadFile(sessionId, localPath, remotePath)
        return { success: result.success, error: result.error }
      }
      
      return { success: false, error: 'SSH upload API not available' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Supprimer un fichier ou dossier
   */
  static async deleteFile(sessionId: string, path: string, isDirectory: boolean = false): Promise<FileOperationResult> {
    try {
      if (window.electronAPI?.sshExecuteCommand) {
        // Pour les dossiers, utiliser rm -rf pour supprimer récursivement
        // Pour les fichiers, utiliser rm simple
        const command = isDirectory ? `rm -rf "${path}"` : `rm "${path}"`
        const result = await window.electronAPI.sshExecuteCommand(sessionId, command)
        return { success: result.success, error: result.error }
      }
      
      return { success: false, error: 'SSH API not available' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Créer un nouveau dossier
   */
  static async createDirectory(sessionId: string, path: string): Promise<FileOperationResult> {
    try {
      if (window.electronAPI?.sshExecuteCommand) {
        const command = `mkdir -p "${path}"`
        const result = await window.electronAPI.sshExecuteCommand(sessionId, command)
        return { success: result.success, error: result.error }
      }
      
      return { success: false, error: 'API SSH non disponible' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Renommer un fichier ou dossier
   */
  static async renameFile(sessionId: string, oldPath: string, newPath: string): Promise<FileOperationResult> {
    try {
      if (window.electronAPI?.sshExecuteCommand) {
        const command = `mv "${oldPath}" "${newPath}"`
        const result = await window.electronAPI.sshExecuteCommand(sessionId, command)
        return { success: result.success, error: result.error }
      }
      
      return { success: false, error: 'API SSH non disponible' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Obtenir les informations détaillées d'un fichier
   */
  static async getFileInfo(sessionId: string, path: string): Promise<FileOperationResult> {
    try {
      if (window.electronAPI?.sshExecuteCommand) {
        const command = `stat "${path}"`
        const result = await window.electronAPI.sshExecuteCommand(sessionId, command)
        
        if (result.success) {
          return { 
            success: true, 
            data: this.parseStatOutput(result.output || '') 
          }
        }
      }
      
      return { success: false, error: 'Impossible d\'obtenir les informations du fichier' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Lire le contenu d'un fichier texte
   */
  static async getFileContent(sessionId: string, path: string): Promise<FileOperationResult> {
    try {
      const electronAPI = window.electronAPI as any
      if (electronAPI?.sshExecuteCommand) {
        const command = `cat "${path}"`
        const result = await electronAPI.sshExecuteCommand(sessionId, command)
        
        if (result.success) {
          return { 
            success: true, 
            data: result.output || '' 
          }
        } else {
          return { success: false, error: result.error || 'Failed to read file' }
        }
      }
      
      return { success: false, error: 'SSH API not available' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Sauvegarder le contenu d'un fichier texte
   */
  static async saveFileContent(sessionId: string, path: string, content: string): Promise<FileOperationResult> {
    try {
      const electronAPI = window.electronAPI as any
      if (electronAPI?.sshExecuteCommand) {
        // Escape content for shell and use cat with heredoc for safe content writing
        const command = `cat > "${path}" << 'EOF'
${content}
EOF`
        const result = await electronAPI.sshExecuteCommand(sessionId, command)
        
        if (result.success) {
          return { success: true }
        } else {
          return { success: false, error: result.error || 'Failed to save file' }
        }
      }
      
      return { success: false, error: 'SSH API not available' }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Parser la sortie de la commande stat
   */
  private static parseStatOutput(output: string): any {
    const lines = output.split('\n')
    const info: any = {}
    
    for (const line of lines) {
      if (line.includes('Size:')) {
        const sizeMatch = line.match(/Size:\s+(\d+)/)
        if (sizeMatch) info.size = parseInt(sizeMatch[1])
      }
      if (line.includes('Access:') && line.includes('(')) {
        const permMatch = line.match(/Access:\s+\((\d+)\/([^)]+)\)/)
        if (permMatch) {
          info.octalPermissions = permMatch[1]
          info.textPermissions = permMatch[2]
        }
      }
      if (line.includes('Uid:')) {
        const ownerMatch = line.match(/Uid:\s+\(\s*(\d+)\/\s*([^)]+)\)\s+Gid:\s+\(\s*(\d+)\/\s*([^)]+)\)/)
        if (ownerMatch) {
          info.uid = ownerMatch[1]
          info.owner = ownerMatch[2]
          info.gid = ownerMatch[3]
          info.group = ownerMatch[4]
        }
      }
    }
    
    return info
  }
}

export default FileService 