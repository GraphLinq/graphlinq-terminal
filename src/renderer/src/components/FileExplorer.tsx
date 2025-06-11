import React, { useEffect, useRef, useState, useCallback, memo } from 'react'
import './FileExplorer.scss'
import FileService, { FileItem as ServiceFileItem } from '../services/fileService'
import CodeEditor from './CodeEditor'
import { 
  FaFolder, 
  FaFolderOpen, 
  FaFile, 
  FaDownload, 
  FaUpload, 
  FaTrash, 
  FaEdit, 
  FaPlus,
  FaHome,
  FaArrowUp,
  FaRedo,
  FaSearch,
  FaCopy,
  FaCut,
  FaPaste,
  FaEye,
  FaTerminal,
  FaCode,
  FaImage,
  FaFileArchive,
  FaFileVideo,
  FaFileAudio,
  FaFileAlt,
  FaFilePdf,
  FaFileExcel,
  FaFileWord,
  FaFilePowerpoint,
  FaTimes,
  FaCheck
} from 'react-icons/fa'
import { BsThreeDotsVertical } from 'react-icons/bs'

interface FileExplorerProps {
  sessionId: string | null
  isConnected: boolean
  isOpen: boolean
  onToggle: () => void
}

// Utilise le type du service
type FileItem = ServiceFileItem

interface FileExplorerState {
  currentPath: string
  files: FileItem[]
  loading: boolean
  selectedFiles: Set<string>
  contextMenuPosition: { x: number; y: number; file: FileItem } | null
  showHidden: boolean
  searchQuery: string
  viewMode: 'list' | 'grid'
  sortBy: 'name' | 'size' | 'modified' | 'type'
  sortOrder: 'asc' | 'desc'
  clipboard: { files: string[]; operation: 'copy' | 'cut' } | null
  isUploading: boolean
  uploadProgress: number
  error: string | null
  // Modal states
  showCreateModal: boolean
  showRenameModal: boolean
  modalInput: string
  modalOriginalName: string
  // Code editor states
  editorOpen: boolean
  editorFile: { path: string; name: string } | null
}

// Modal Component
interface InputModalProps {
  isOpen: boolean
  title: string
  placeholder: string
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}

const InputModal: React.FC<InputModalProps> = ({ 
  isOpen, 
  title, 
  placeholder, 
  defaultValue = '', 
  onConfirm, 
  onCancel 
}) => {
  const [value, setValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onConfirm(value.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="input-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-content">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={handleKeyDown}
            className="modal-input"
          />
          <div className="modal-actions">
            <button type="button" onClick={onCancel} className="cancel-btn">
              <FaTimes />
              Cancel
            </button>
            <button type="submit" disabled={!value.trim()} className="confirm-btn">
              <FaCheck />
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const defaultState: FileExplorerState = {
  currentPath: '/',
  files: [],
  loading: false,
  selectedFiles: new Set(),
  contextMenuPosition: null,
  showHidden: false,
  searchQuery: '',
  viewMode: 'list',
  sortBy: 'name',
  sortOrder: 'asc',
  clipboard: null,
  isUploading: false,
  uploadProgress: 0,
  error: null,
  showCreateModal: false,
  showRenameModal: false,
  modalInput: '',
  modalOriginalName: '',
  editorOpen: false,
  editorFile: null
}

// Icône basée sur l'extension du fichier
const getFileIcon = (filename: string, isDirectory: boolean) => {
  if (isDirectory) {
    return <FaFolder className="file-icon directory" />
  }
  
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  
  const iconMap: { [key: string]: React.ReactNode } = {
    // Code
    'js': <FaCode className="file-icon code" />,
    'ts': <FaCode className="file-icon code" />,
    'jsx': <FaCode className="file-icon code" />,
    'tsx': <FaCode className="file-icon code" />,
    'py': <FaCode className="file-icon code" />,
    'java': <FaCode className="file-icon code" />,
    'cpp': <FaCode className="file-icon code" />,
    'c': <FaCode className="file-icon code" />,
    'php': <FaCode className="file-icon code" />,
    'html': <FaCode className="file-icon code" />,
    'css': <FaCode className="file-icon code" />,
    'scss': <FaCode className="file-icon code" />,
    'json': <FaCode className="file-icon code" />,
    'xml': <FaCode className="file-icon code" />,
    'yml': <FaCode className="file-icon code" />,
    'yaml': <FaCode className="file-icon code" />,
    
    // Images
    'jpg': <FaImage className="file-icon image" />,
    'jpeg': <FaImage className="file-icon image" />,
    'png': <FaImage className="file-icon image" />,
    'gif': <FaImage className="file-icon image" />,
    'svg': <FaImage className="file-icon image" />,
    'webp': <FaImage className="file-icon image" />,
    'bmp': <FaImage className="file-icon image" />,
    'ico': <FaImage className="file-icon image" />,
    
    // Archives
    'zip': <FaFileArchive className="file-icon archive" />,
    'rar': <FaFileArchive className="file-icon archive" />,
    '7z': <FaFileArchive className="file-icon archive" />,
    'tar': <FaFileArchive className="file-icon archive" />,
    'gz': <FaFileArchive className="file-icon archive" />,
    'bz2': <FaFileArchive className="file-icon archive" />,
    
    // Vidéo
    'mp4': <FaFileVideo className="file-icon video" />,
    'avi': <FaFileVideo className="file-icon video" />,
    'mkv': <FaFileVideo className="file-icon video" />,
    'mov': <FaFileVideo className="file-icon video" />,
    'wmv': <FaFileVideo className="file-icon video" />,
    'flv': <FaFileVideo className="file-icon video" />,
    'webm': <FaFileVideo className="file-icon video" />,
    
    // Audio
    'mp3': <FaFileAudio className="file-icon audio" />,
    'wav': <FaFileAudio className="file-icon audio" />,
    'flac': <FaFileAudio className="file-icon audio" />,
    'ogg': <FaFileAudio className="file-icon audio" />,
    'aac': <FaFileAudio className="file-icon audio" />,
    'm4a': <FaFileAudio className="file-icon audio" />,
    
    // Documents
    'pdf': <FaFilePdf className="file-icon pdf" />,
    'doc': <FaFileWord className="file-icon word" />,
    'docx': <FaFileWord className="file-icon word" />,
    'xls': <FaFileExcel className="file-icon excel" />,
    'xlsx': <FaFileExcel className="file-icon excel" />,
    'ppt': <FaFilePowerpoint className="file-icon powerpoint" />,
    'pptx': <FaFilePowerpoint className="file-icon powerpoint" />,
    'txt': <FaFileAlt className="file-icon text" />,
    'md': <FaFileAlt className="file-icon text" />,
    'rtf': <FaFileAlt className="file-icon text" />
  }
  
  return iconMap[ext] || <FaFile className="file-icon default" />
}

// Check if a file can be edited (text/code files)
const isEditableFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  
  const editableExtensions = [
    // Programming languages
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'cc', 'cxx', 'h', 'hpp',
    'cs', 'php', 'rb', 'go', 'rs', 'swift', 'kt', 'scala', 'r',
    // Web technologies
    'html', 'htm', 'css', 'scss', 'sass', 'less', 'vue',
    // Data formats
    'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf',
    // Shell and scripts
    'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
    // Database
    'sql',
    // Markup and documentation
    'md', 'markdown', 'tex', 'dockerfile',
    // Config files
    'gitignore', 'gitattributes', 'editorconfig', 'eslintrc', 'prettierrc',
    // Logs and plain text
    'log', 'txt', 'env', 'properties'
  ]
  
  return editableExtensions.includes(ext) || !ext || fileName.startsWith('.')
}

// Formater la taille des fichiers
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US') + ' ' + date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

// Composant pour un élément de fichier
const FileItemComponent = memo<{
  file: FileItem
  isSelected: boolean
  onSelect: (name: string, isCtrlKey: boolean) => void
  onDoubleClick: (file: FileItem) => void
  onContextMenu: (e: React.MouseEvent, file: FileItem) => void
  viewMode: 'list' | 'grid'
}>(({ file, isSelected, onSelect, onDoubleClick, onContextMenu, viewMode }) => {
  const handleClick = (e: React.MouseEvent) => {
    onSelect(file.name, e.ctrlKey || e.metaKey)
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onDoubleClick(file)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onContextMenu(e, file)
  }

  return (
    <div 
      className={`file-item ${isSelected ? 'selected' : ''} ${viewMode}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <div className="file-icon-container">
        {getFileIcon(file.name, file.type === 'directory')}
        {file.isSymlink && <div className="symlink-indicator">→</div>}
      </div>
      
      <div className="file-info">
        <div className="file-name" title={file.name}>
          {file.name}
          {file.isSymlink && file.target && (
            <span className="symlink-target"> → {file.target}</span>
          )}
        </div>
        
        {viewMode === 'list' && (
          <>
            <div className="file-size">
              {file.type === 'file' ? formatFileSize(file.size) : '—'}
            </div>
            <div className="file-modified">
              {formatDate(file.lastModified)}
            </div>
            <div className="file-permissions">
              {file.permissions}
            </div>
            <div className="file-owner">
              {file.owner}:{file.group}
            </div>
          </>
        )}
      </div>
    </div>
  )
})

const FileExplorer: React.FC<FileExplorerProps> = ({ sessionId, isConnected, isOpen, onToggle }) => {
  const [state, setState] = useState<FileExplorerState>(defaultState)
  const [width, setWidth] = useState(800) // Default to maximum width
  const [isResizing, setIsResizing] = useState(false)

  // Charger les fichiers du répertoire courant
  const loadFiles = useCallback(async (path: string = state.currentPath) => {
    if (!sessionId || !isConnected) {
      console.log('Pas de session ou pas connecté:', { sessionId, isConnected })
      return
    }

    console.log('Chargement des fichiers pour le chemin:', path)
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Utiliser le service de fichiers
      const files = await FileService.listFiles(sessionId, path)
      console.log('Fichiers reçus:', files)
      
      const filteredFiles = files.filter(file => state.showHidden || !file.isHidden)
      console.log('Fichiers filtrés:', filteredFiles)
      
      setState(prev => ({ 
        ...prev, 
        files: filteredFiles,
        currentPath: path,
        loading: false 
      }))
    } catch (error) {
      console.error('Erreur lors du chargement des fichiers:', error)
      setState(prev => ({ 
        ...prev, 
        error: 'Erreur lors du chargement des fichiers: ' + (error as Error).message,
        loading: false 
      }))
    }
  }, [sessionId, isConnected, state.currentPath, state.showHidden])

  // Navigation
  const navigateTo = useCallback((path: string) => {
    console.log('Navigation vers:', path)
    loadFiles(path)
  }, [loadFiles])

  const navigateUp = useCallback(() => {
    const pathParts = state.currentPath.split('/').filter(Boolean)
    const parentPath = pathParts.length > 1 ? '/' + pathParts.slice(0, -1).join('/') : '/'
    console.log('Navigation vers parent:', parentPath)
    navigateTo(parentPath)
  }, [state.currentPath, navigateTo])

  const navigateHome = useCallback(() => {
    navigateTo('/')
  }, [navigateTo])

  // Sélection de fichiers
  const handleFileSelect = useCallback((fileName: string, isCtrlKey: boolean) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedFiles)
      
      if (isCtrlKey) {
        if (newSelected.has(fileName)) {
          newSelected.delete(fileName)
        } else {
          newSelected.add(fileName)
        }
      } else {
        newSelected.clear()
        newSelected.add(fileName)
      }
      
      return { ...prev, selectedFiles: newSelected }
    })
  }, [])

  // Double-clic sur fichier/dossier
  const handleFileDoubleClick = useCallback((file: FileItem) => {
    console.log('Double-clic sur:', file.name, 'type:', file.type)
    if (file.type === 'directory') {
      const newPath = state.currentPath === '/' 
        ? `/${file.name}` 
        : `${state.currentPath}/${file.name}`
      console.log('Navigation vers dossier:', newPath)
      navigateTo(newPath)
    } else if (isEditableFile(file.name)) {
      // Open the file in the code editor
      openFileInEditor(file.name)
    } else {
      // Download the file for other types
      console.log('Downloading:', file.name)
      handleDownload([file.name])
    }
  }, [state.currentPath, navigateTo])

  // Open file in code editor
  const openFileInEditor = useCallback((fileName: string, fullPath?: string) => {
    // Si fullPath est fourni, l'utiliser directement, sinon construire le chemin
    const filePath = fullPath || (state.currentPath === '/' 
      ? `/${fileName}` 
      : `${state.currentPath}/${fileName}`)
    
    // Extraire juste le nom du fichier pour l'affichage
    const displayName = fullPath ? fullPath.split('/').pop() || fileName : fileName
    
    setState(prev => ({
      ...prev,
      editorOpen: true,
      editorFile: { path: filePath, name: displayName }
    }))
  }, [state.currentPath])

  // Close code editor
  const closeEditor = useCallback(() => {
    setState(prev => ({
      ...prev,
      editorOpen: false,
      editorFile: null
    }))
  }, [])

  // Menu contextuel
  const handleContextMenu = useCallback((e: React.MouseEvent, file: FileItem) => {
    setState(prev => ({
      ...prev,
      contextMenuPosition: { x: e.clientX, y: e.clientY, file }
    }))
  }, [])

  const closeContextMenu = useCallback(() => {
    setState(prev => ({ ...prev, contextMenuPosition: null }))
  }, [])

  // Actions sur les fichiers
  const handleDownload = useCallback(async (fileNames: string[] = Array.from(state.selectedFiles)) => {
    if (!sessionId || !isConnected || fileNames.length === 0) return

    try {
      for (const fileName of fileNames) {
        const filePath = state.currentPath === '/' 
          ? `/${fileName}` 
          : `${state.currentPath}/${fileName}`
        
        const result = await FileService.downloadFile(sessionId, filePath)
        if (!result.success) {
          throw new Error(result.error || 'Erreur de téléchargement')
        }
      }
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error)
      setState(prev => ({ ...prev, error: 'Erreur lors du téléchargement' }))
    }
  }, [sessionId, isConnected, state.selectedFiles, state.currentPath])

  const handleUploadClick = useCallback(async () => {
    if (!sessionId || !isConnected) return

    try {
      // Use Electron dialog to select files
      const electronAPI = window.electronAPI as any
      if (!electronAPI?.selectFilesForUpload) {
        setState(prev => ({ ...prev, error: 'File selection API not available' }))
        return
      }
      
      const result = await electronAPI.selectFilesForUpload()
      if (!result || result.canceled || result.filePaths.length === 0) {
        return
      }

      setState(prev => ({ ...prev, isUploading: true, uploadProgress: 0 }))

      for (let i = 0; i < result.filePaths.length; i++) {
        const localPath = result.filePaths[i]
        const fileName = localPath.split(/[/\\]/).pop() || 'unknown'
        const remotePath = state.currentPath === '/' 
          ? `/${fileName}` 
          : `${state.currentPath}/${fileName}`
        
        console.log('Uploading file:', fileName, 'from', localPath, 'to', remotePath)
        
        const uploadResult = await FileService.uploadFile(sessionId, localPath, remotePath)
        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Upload error')
        }
        
        setState(prev => ({ 
          ...prev, 
          uploadProgress: ((i + 1) / result.filePaths.length) * 100 
        }))
      }
      
      // Reload files after upload
      await loadFiles()
    } catch (error) {
      console.error('Upload error:', error)
      setState(prev => ({ ...prev, error: 'Upload error' }))
    } finally {
      setState(prev => ({ ...prev, isUploading: false, uploadProgress: 0 }))
    }
  }, [sessionId, isConnected, state.currentPath, loadFiles])

  const handleDelete = useCallback(async (fileNames: string[] = Array.from(state.selectedFiles)) => {
    if (!sessionId || !isConnected || fileNames.length === 0) return

    // Create a more detailed confirmation message
    const filesToDelete = fileNames.map(fileName => state.files.find(f => f.name === fileName)).filter(Boolean)
    const hasDirectories = filesToDelete.some(file => file?.type === 'directory')
    
    let confirmMessage = `Are you sure you want to delete ${fileNames.length} item(s)?`
    if (hasDirectories) {
      confirmMessage += '\n\nThis includes directories and all their contents will be permanently deleted.'
    }
    
    const confirmed = window.confirm(confirmMessage)
    if (!confirmed) return

    try {
      for (const fileName of fileNames) {
        const filePath = state.currentPath === '/' 
          ? `/${fileName}` 
          : `${state.currentPath}/${fileName}`
        
        const fileToDelete = state.files.find(f => f.name === fileName)
        const result = await FileService.deleteFile(sessionId, filePath, fileToDelete?.type === 'directory')
        if (!result.success) {
          throw new Error(result.error || 'Delete error')
        }
      }
      
      // Reload files after deletion
      await loadFiles()
      setState(prev => ({ ...prev, selectedFiles: new Set() }))
    } catch (error) {
      console.error('Error during deletion:', error)
      setState(prev => ({ ...prev, error: 'Error during deletion' }))
    }
  }, [sessionId, isConnected, state.selectedFiles, state.currentPath, state.files, loadFiles])

  const handleCreateDirectory = useCallback(async (dirName?: string) => {
    if (!sessionId || !isConnected) return

    // Use dirName from modal or current modalInput
    const nameToUse = dirName || state.modalInput
    if (!nameToUse || nameToUse.trim() === '') return

    try {
      const dirPath = state.currentPath === '/' 
        ? `/${nameToUse.trim()}` 
        : `${state.currentPath}/${nameToUse.trim()}`
      
      const result = await FileService.createDirectory(sessionId, dirPath)
      if (!result.success) {
        throw new Error(result.error || 'Error creating directory')
      }
      
      // Reload files after creation
      await loadFiles()
    } catch (error) {
      console.error('Error creating directory:', error)
      setState(prev => ({ ...prev, error: 'Error creating directory' }))
    }
  }, [sessionId, isConnected, state.currentPath, state.modalInput, loadFiles])

  const handleRename = useCallback(async (newName: string) => {
    if (!sessionId || !isConnected || !state.contextMenuPosition) return

    const fileName = state.contextMenuPosition.file.name
    if (!newName || newName.trim() === '' || newName === fileName) return

    try {
      const oldPath = state.currentPath === '/' 
        ? `/${fileName}` 
        : `${state.currentPath}/${fileName}`
      
      const newPath = state.currentPath === '/' 
        ? `/${newName.trim()}` 
        : `${state.currentPath}/${newName.trim()}`
      
      const result = await FileService.renameFile(sessionId, oldPath, newPath)
      if (!result.success) {
        throw new Error(result.error || 'Error renaming file')
      }
      
      // Reload files after rename
      await loadFiles()
      setState(prev => ({ ...prev, selectedFiles: new Set() }))
    } catch (error) {
      console.error('Error renaming file:', error)
      setState(prev => ({ ...prev, error: 'Error renaming file' }))
    }
  }, [sessionId, isConnected, state.currentPath, state.contextMenuPosition, loadFiles])

  // Gestion du redimensionnement
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(800, startWidth + (startX - e.clientX)))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    e.preventDefault()
  }

  // Charger les fichiers initiaux
  useEffect(() => {
    if (isConnected && sessionId && isOpen) {
      loadFiles()
    }
  }, [isConnected, sessionId, isOpen, loadFiles])

  // Fermer le menu contextuel en cliquant ailleurs
  useEffect(() => {
    const handleClickOutside = () => {
      if (state.contextMenuPosition) {
        closeContextMenu()
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [state.contextMenuPosition, closeContextMenu])

  // Listen for AI navigation events
  useEffect(() => {
    const handleNavigateFileExplorer = (event: CustomEvent) => {
      const { path, reason } = event.detail;
      console.log(`🤖 AI requested navigation to: ${path} (${reason})`);
      
      // Navigate to the requested path
      navigateTo(path);
      
      // Show a brief notification
      setState(prev => ({ 
        ...prev, 
        error: `🤖 IA: ${reason}` 
      }));
      
      // Clear the notification after a few seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, 5000);
    };

    const handleOpenFileInEditor = (event: CustomEvent) => {
      const { filepath, reason } = event.detail;
      console.log(`🤖 AI requested to open file: ${filepath} (${reason})`);
      
      // Parse the directory and filename
      const pathParts = filepath.split('/').filter(Boolean); // Remove empty parts
      const fileName = pathParts.pop() || '';
      const directoryPath = pathParts.length > 0 ? '/' + pathParts.join('/') : '/';
      
      console.log(`Parsed path: directory=${directoryPath}, file=${fileName}, fullPath=${filepath}`);
      
      // Show notification immediately
      setState(prev => ({ 
        ...prev, 
        error: `🤖 IA: ${reason}` 
      }));
      
      // Function to open the file
      const openFile = () => {
        openFileInEditor(fileName, filepath);
        console.log(`Opened file in editor: ${filepath}`);
      };
      
      // If we need to navigate to a different directory, do it first
      if (directoryPath !== state.currentPath) {
        console.log(`Navigating from ${state.currentPath} to ${directoryPath}`);
        navigateTo(directoryPath);
        // Wait for navigation to complete, then open file
        setTimeout(openFile, 800);
      } else {
        // Same directory, open immediately
        openFile();
      }
      
      // Clear the notification after a few seconds
      setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, 5000);
    };

    window.addEventListener('navigate-file-explorer', handleNavigateFileExplorer as EventListener);
    window.addEventListener('open-file-in-editor', handleOpenFileInEditor as EventListener);

    return () => {
      window.removeEventListener('navigate-file-explorer', handleNavigateFileExplorer as EventListener);
      window.removeEventListener('open-file-in-editor', handleOpenFileInEditor as EventListener);
    };
  }, [navigateTo, openFileInEditor, state.currentPath])

  // Filtrer les fichiers selon la recherche
  const filteredFiles = state.files.filter(file => 
    file.name.toLowerCase().includes(state.searchQuery.toLowerCase())
  )
  
  console.log('État actuel:', {
    currentPath: state.currentPath,
    filesCount: state.files.length,
    filteredCount: filteredFiles.length,
    loading: state.loading,
    error: state.error,
    isConnected,
    sessionId
  })

  // Trier les fichiers
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    // Les dossiers en premier
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    
    let compareValue = 0
    switch (state.sortBy) {
      case 'name':
        compareValue = a.name.localeCompare(b.name)
        break
      case 'size':
        compareValue = a.size - b.size
        break
      case 'modified':
        compareValue = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
        break
      case 'type':
        const aExt = a.name.split('.').pop() || ''
        const bExt = b.name.split('.').pop() || ''
        compareValue = aExt.localeCompare(bExt)
        break
    }
    
    return state.sortOrder === 'asc' ? compareValue : -compareValue
  })

  if (!isConnected) {
    return (
      <div className={`file-explorer ${isOpen ? 'open' : ''}`}>
        <div className="file-explorer-header">
          <h3>File Explorer</h3>
          <button onClick={onToggle} className="close-btn">×</button>
        </div>
        <div className="file-explorer-content">
          <div className="not-connected">
            <FaTerminal className="terminal-icon" />
            <p>Connect to an SSH server to explore files</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div 
        className={`file-explorer ${isOpen ? 'open' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ width: `${width}px` }}
      >
        {/* Resize handle */}
        <div 
          className="resize-handle" 
          onMouseDown={handleMouseDown}
        />
        
        {/* Header */}
        <div className="file-explorer-header">
          <h3>File Explorer</h3>
          <button onClick={onToggle} className="close-btn">×</button>
        </div>

        {/* Toolbar */}
        <div className="file-explorer-toolbar">
          <div className="toolbar-section navigation">
            <button onClick={navigateHome} title="Home Directory">
              <FaHome />
            </button>
            <button onClick={navigateUp} title="Parent Directory">
              <FaArrowUp />
            </button>
            <button onClick={() => loadFiles()} title="Refresh">
              <FaRedo />
            </button>
          </div>
          
          <div className="toolbar-section actions">
            <button 
              onClick={() => setState(prev => ({ ...prev, showCreateModal: true }))} 
              title="Create New Directory"
            >
              <FaPlus />
            </button>
            <button 
              onClick={handleUploadClick} 
              title="Upload Files"
            >
              <FaUpload />
            </button>
            <button 
              onClick={() => handleDownload()} 
              disabled={state.selectedFiles.size === 0}
              title="Download Selected Files"
            >
              <FaDownload />
            </button>
            <button 
              onClick={() => handleDelete()} 
              disabled={state.selectedFiles.size === 0}
              title="Delete Selected Files"
            >
              <FaTrash />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="file-explorer-breadcrumb">
          <div className="breadcrumb-path">
            {state.currentPath.split('/').filter(Boolean).reduce((acc, part, index, array) => {
              const path = '/' + array.slice(0, index + 1).join('/')
              acc.push(
                <span key={path}>
                  <button onClick={() => navigateTo(path)}>{part}</button>
                  {index < array.length - 1 && <span className="separator">/</span>}
                </span>
              )
              return acc
            }, [<button key="root" onClick={() => navigateTo('/')}>root</button>])}
          </div>
        </div>

        {/* Search */}
        <div className="file-explorer-search">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search files..."
            value={state.searchQuery}
            onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
          />
        </div>

        {/* File list */}
        <div className="file-explorer-content">
          {state.loading ? (
            <div className="loading">
              <div className="loading-spinner"></div>
              <p>Loading files...</p>
            </div>
          ) : state.error ? (
            <div className="error">
              <p>{state.error}</p>
              <button onClick={() => loadFiles()}>Retry</button>
            </div>
          ) : (
            <div className={`file-list ${state.viewMode}`}>
              {state.viewMode === 'list' && (
                <div className="file-list-header">
                  <div className="header-name">Name</div>
                  <div className="header-size">Size</div>
                  <div className="header-modified">Modified</div>
                  <div className="header-permissions">Permissions</div>
                  <div className="header-owner">Owner</div>
                </div>
              )}
              
              {sortedFiles.map(file => (
                <FileItemComponent
                  key={file.name}
                  file={file}
                  isSelected={state.selectedFiles.has(file.name)}
                  onSelect={handleFileSelect}
                  onDoubleClick={handleFileDoubleClick}
                  onContextMenu={handleContextMenu}
                  viewMode={state.viewMode}
                />
              ))}
              
              {sortedFiles.length === 0 && !state.loading && (
                <div className="empty-folder">
                  <FaFolder className="empty-icon" />
                  <p>This folder is empty</p>
                  <p>Upload files or create a new directory to get started</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload progress */}
        {state.isUploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${state.uploadProgress}%` }}
              />
            </div>
            <span>{Math.round(state.uploadProgress)}%</span>
          </div>
        )}


      </div>

      {/* Context menu */}
      {state.contextMenuPosition && (
        <div 
          className="file-context-menu"
          style={{
            left: state.contextMenuPosition.x,
            top: state.contextMenuPosition.y
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Show Edit option for editable files */}
          {state.contextMenuPosition.file.type === 'file' && isEditableFile(state.contextMenuPosition.file.name) && (
            <button onClick={() => {
              openFileInEditor(state.contextMenuPosition!.file.name)
              closeContextMenu()
            }}>
              <FaCode />
              Edit
            </button>
          )}
          
          <button onClick={() => {
            handleDownload([state.contextMenuPosition!.file.name])
            closeContextMenu()
          }}>
            <FaDownload />
            Download
          </button>
          
          <button onClick={() => {
            setState(prev => ({ 
              ...prev, 
              showRenameModal: true,
              modalOriginalName: state.contextMenuPosition!.file.name
            }))
            closeContextMenu()
          }}>
            <FaEdit />
            Rename
          </button>
          
          <button onClick={() => {
            handleDelete([state.contextMenuPosition!.file.name])
            closeContextMenu()
          }}>
            <FaTrash />
            Delete
          </button>
          
          <hr />
          
          <button onClick={closeContextMenu}>
            <FaEye />
            Properties
          </button>
        </div>
      )}

      {/* Overlay */}
      {isOpen && <div className="file-explorer-overlay" onClick={onToggle} />}

             {/* Create directory modal */}
       {state.showCreateModal && (
         <InputModal
           isOpen={state.showCreateModal}
           title="Create Directory"
           placeholder="Enter directory name"
           onConfirm={(name) => {
             handleCreateDirectory(name)
             setState(prev => ({ ...prev, showCreateModal: false }))
           }}
           onCancel={() => setState(prev => ({ ...prev, showCreateModal: false }))}
         />
       )}

             {/* Rename file modal */}
       {state.showRenameModal && (
         <InputModal
           isOpen={state.showRenameModal}
           title="Rename File"
           placeholder="Enter new name"
           defaultValue={state.modalOriginalName}
           onConfirm={(name) => {
             handleRename(name)
             setState(prev => ({ ...prev, showRenameModal: false }))
           }}
           onCancel={() => setState(prev => ({ ...prev, showRenameModal: false }))}
         />
       )}

       {/* Code Editor */}
       {state.editorOpen && state.editorFile && (
         <CodeEditor
           sessionId={sessionId}
           isConnected={isConnected}
           filePath={state.editorFile.path}
           fileName={state.editorFile.name}
           onClose={closeEditor}
           isOpen={state.editorOpen}
         />
       )}
    </>
  )
}

export default FileExplorer 