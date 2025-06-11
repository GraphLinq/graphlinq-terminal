import React, { useCallback, useEffect, useState, useRef } from 'react'
import Editor, { Monaco } from '@monaco-editor/react'
import './CodeEditor.scss'
import { 
  FaSave, 
  FaTimes, 
  FaUndo, 
  FaRedo, 
  FaSearch, 
  FaCog,
  FaExpand,
  FaCompress,
  FaFile,
  FaFileMedical
} from 'react-icons/fa'
import FileService from '../services/fileService'

interface CodeEditorProps {
  sessionId: string | null
  isConnected: boolean
  filePath: string
  fileName: string
  onClose: () => void
  isOpen: boolean
}

interface EditorState {
  content: string
  originalContent: string
  isDirty: boolean
  language: string
  loading: boolean
  saving: boolean
  error: string | null
  isFullscreen: boolean
  findWidgetVisible: boolean
}

// Map file extensions to Monaco languages
const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  const languageMap: { [key: string]: string } = {
    // Programming languages
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'py': 'python',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'cc': 'cpp',
    'cxx': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'swift': 'swift',
    'kt': 'kotlin',
    'scala': 'scala',
    'r': 'r',
    
    // Web technologies
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'less': 'less',
    'vue': 'html',
    
    // Data formats
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'ini': 'ini',
    'cfg': 'ini',
    'conf': 'ini',
    
    // Shell and scripts
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'fish': 'shell',
    'ps1': 'powershell',
    'bat': 'bat',
    'cmd': 'bat',
    
    // Database
    'sql': 'sql',
    
    // Markup and documentation
    'md': 'markdown',
    'markdown': 'markdown',
    'tex': 'latex',
    'dockerfile': 'dockerfile',
    
    // Logs and plain text
    'log': 'plaintext',
    'txt': 'plaintext'
  }
  
  return languageMap[ext || ''] || 'plaintext'
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  sessionId, 
  isConnected, 
  filePath, 
  fileName,
  onClose,
  isOpen 
}) => {
  const [state, setState] = useState<EditorState>({
    content: '',
    originalContent: '',
    isDirty: false,
    language: getLanguageFromFileName(fileName),
    loading: true,
    saving: false,
    error: null,
    isFullscreen: false,
    findWidgetVisible: false
  })
  
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)

  // Load file content
  const loadFile = useCallback(async () => {
    if (!sessionId || !isConnected) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // For text files, we'll read them using cat command
      const result = await FileService.getFileContent(sessionId, filePath)
      
      if (result.success) {
        const content = result.data || ''
        setState(prev => ({
          ...prev,
          content,
          originalContent: content,
          isDirty: false,
          loading: false
        }))
      } else {
        throw new Error(result.error || 'Failed to load file')
      }
    } catch (error) {
      console.error('Error loading file:', error)
      setState(prev => ({
        ...prev,
        error: `Failed to load file: ${(error as Error).message}`,
        loading: false
      }))
    }
  }, [sessionId, isConnected, filePath])

  // Save file content
  const saveFile = useCallback(async () => {
    if (!sessionId || !isConnected || !state.isDirty) return

    setState(prev => ({ ...prev, saving: true, error: null }))

    try {
      const result = await FileService.saveFileContent(sessionId, filePath, state.content)
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          originalContent: prev.content,
          isDirty: false,
          saving: false
        }))
      } else {
        throw new Error(result.error || 'Failed to save file')
      }
    } catch (error) {
      console.error('Error saving file:', error)
      setState(prev => ({
        ...prev,
        error: `Failed to save file: ${(error as Error).message}`,
        saving: false
      }))
    }
  }, [sessionId, isConnected, filePath, state.content, state.isDirty])

  // Handle editor change
  const handleEditorChange = useCallback((value: string | undefined) => {
    const newContent = value || ''
    setState(prev => ({
      ...prev,
      content: newContent,
      isDirty: newContent !== prev.originalContent
    }))
  }, [])

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor: any, monaco: Monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    
    // Configure editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveFile)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      setState(prev => ({ ...prev, findWidgetVisible: true }))
      editor.getAction('actions.find').run()
    })
  }, [saveFile])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 's':
          e.preventDefault()
          saveFile()
          break
        case 'f':
          e.preventDefault()
          setState(prev => ({ ...prev, findWidgetVisible: true }))
          if (editorRef.current) {
            editorRef.current.getAction('actions.find').run()
          }
          break
        case 'z':
          if (!e.shiftKey) {
            e.preventDefault()
            if (editorRef.current) {
              editorRef.current.trigger('keyboard', 'undo', null)
            }
          }
          break
        case 'y':
          e.preventDefault()
          if (editorRef.current) {
            editorRef.current.trigger('keyboard', 'redo', null)
          }
          break
      }
    }
    
    if (e.key === 'Escape') {
      if (state.findWidgetVisible) {
        setState(prev => ({ ...prev, findWidgetVisible: false }))
      } else if (state.isFullscreen) {
        setState(prev => ({ ...prev, isFullscreen: false }))
      }
    }
  }, [isOpen, saveFile, state.findWidgetVisible, state.isFullscreen])

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setState(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }))
  }, [])

  // Handle close with unsaved changes check
  const handleClose = useCallback(() => {
    if (state.isDirty) {
      const shouldSave = window.confirm(
        'You have unsaved changes. Do you want to save before closing?'
      )
      if (shouldSave) {
        saveFile().then(() => onClose())
      } else {
        const shouldDiscard = window.confirm(
          'Are you sure you want to discard your changes?'
        )
        if (shouldDiscard) {
          onClose()
        }
      }
    } else {
      onClose()
    }
  }, [state.isDirty, saveFile, onClose])

  // Load file when component mounts or file changes
  useEffect(() => {
    if (isOpen) {
      loadFile()
    }
  }, [isOpen, loadFile])

  // Add keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  return (
    <div className={`code-editor-overlay ${state.isFullscreen ? 'fullscreen' : ''}`}>
      <div className="code-editor-container">
        {/* Header */}
        <div className="code-editor-header">
          <div className="header-left">
            <div className="file-info">
              <FaFile className="file-icon" />
              <span className="file-name">
                {fileName}
                {state.isDirty && <span className="dirty-indicator">•</span>}
              </span>
              <span className="file-path">{filePath}</span>
            </div>
          </div>
          
          <div className="header-center">
            <div className="language-info">
              <span>{state.language}</span>
            </div>
          </div>
          
          <div className="header-right">
            <button
              onClick={() => editorRef.current?.trigger('keyboard', 'undo', null)}
              title="Undo (Ctrl+Z)"
              disabled={state.loading}
            >
              <FaUndo />
            </button>
            
            <button
              onClick={() => editorRef.current?.trigger('keyboard', 'redo', null)}
              title="Redo (Ctrl+Y)"
              disabled={state.loading}
            >
              <FaRedo />
            </button>
            
            <button
              onClick={() => editorRef.current?.getAction('actions.find').run()}
              title="Find (Ctrl+F)"
              disabled={state.loading}
            >
              <FaSearch />
            </button>
            
            <button
              onClick={saveFile}
              title="Save (Ctrl+S)"
              disabled={state.loading || state.saving || !state.isDirty}
              className={state.isDirty ? 'dirty' : ''}
            >
              <FaSave />
            </button>
            
            <button
              onClick={toggleFullscreen}
              title="Toggle Fullscreen"
            >
              {state.isFullscreen ? <FaCompress /> : <FaExpand />}
            </button>
            
            <button
              onClick={handleClose}
              title="Close"
              className="close-button"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="code-editor-status">
          <div className="status-left">
            {state.loading && <span>Loading...</span>}
            {state.saving && <span>Saving...</span>}
            {state.error && <span className="error">{state.error}</span>}
            {!state.loading && !state.saving && !state.error && (
              <span>Ready</span>
            )}
          </div>
          
          <div className="status-right">
            <span>Lines: {state.content.split('\n').length}</span>
            <span>Characters: {state.content.length}</span>
          </div>
        </div>

        {/* Editor */}
        <div className="code-editor-content">
          {state.loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading file...</p>
            </div>
          ) : state.error ? (
            <div className="error-container">
              <p>{state.error}</p>
              <button onClick={loadFile}>Retry</button>
            </div>
          ) : (
            <Editor
              height="100%"
              language={state.language}
              value={state.content}
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                tabSize: 2,
                insertSpaces: true,
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderWhitespace: 'boundary',
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                folding: true,
                foldingHighlight: true,
                bracketPairColorization: { enabled: true },
                guides: {
                  bracketPairs: true,
                  indentation: true
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default CodeEditor 