import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import './Terminal.scss'
import TerminalOptionsModal, { TerminalOptions } from './TerminalOptionsModal'

interface TerminalProps {
  sessionId: string | null
  isConnected: boolean
  onDisconnect: () => void
  isVisible?: boolean
  onRegisterHandler?: (sessionId: string, handler: (data: string) => void) => void
  onUnregisterHandler?: (sessionId: string) => void
}

const Terminal: React.FC<TerminalProps> = ({ 
  sessionId, 
  isConnected, 
  onDisconnect, 
  isVisible = true,
  onRegisterHandler,
  onUnregisterHandler
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState<boolean>(false)
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string>('/home')
  const [terminalOptions, setTerminalOptions] = useState<TerminalOptions>({})
  const sessionIdRef = useRef<string | null>(sessionId)

  // Update sessionId ref when sessionId changes
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  // Handle terminal visibility changes
  useEffect(() => {
    if (isVisible && xtermRef.current && fitAddonRef.current) {
      // When terminal becomes visible again, refit it
      setTimeout(() => {
        fitAddonRef.current?.fit()
      }, 50)
    }
  }, [isVisible])

  // Handle options change from modal
  const handleOptionsChange = useCallback((options: TerminalOptions) => {
    console.log('Applying new options:', options);
    setTerminalOptions(options);
    
    if (!xtermRef.current) return;

    const terminal = xtermRef.current;
    
    try {
      // Apply theme if provided
      if (options.appearance?.theme) {
        const defaultTheme = {
          background: '#1a1a2e',
          foreground: '#e0e7ff',
          cursor: '#8b5cf6',
          cursorAccent: '#1a1a2e',
          selectionBackground: '#6366f1',
          black: '#0f1419',
          red: '#ef4444',
          green: '#10b981',
          yellow: '#f59e0b',
          blue: '#3b82f6',
          magenta: '#8b5cf6',
          cyan: '#06b6d4',
          white: '#e0e7ff',
          brightBlack: '#8b8db8',
          brightRed: '#f87171',
          brightGreen: '#34d399',
          brightYellow: '#fbbf24',
          brightBlue: '#60a5fa',
          brightMagenta: '#a855f7',
          brightCyan: '#22d3ee',
          brightWhite: '#ffffff'
        };
        
        const newTheme = { ...defaultTheme, ...options.appearance.theme };
        
        // Force update the theme
        terminal.options.theme = newTheme;
        
        // Apply background color to the container and xterm elements
        if (newTheme.background && terminalRef.current) {
          terminalRef.current.style.backgroundColor = newTheme.background;
          // Also apply to the xterm viewport and screen
          const viewport = terminalRef.current.querySelector('.xterm-viewport') as HTMLElement;
          const screen = terminalRef.current.querySelector('.xterm-screen') as HTMLElement;
          if (viewport) {
            viewport.style.backgroundColor = newTheme.background;
          }
          if (screen) {
            screen.style.backgroundColor = newTheme.background;
          }
        }
        
        // Clear and refresh the entire terminal to apply theme changes
        const currentBuffer = terminal.buffer.active;
        const content: string[] = [];
        for (let i = 0; i < currentBuffer.length; i++) {
          const line = currentBuffer.getLine(i);
          if (line) {
            content.push(line.translateToString(true));
          }
        }
        
        // Clear terminal
        terminal.clear();
        
        // Write back content with new theme
        setTimeout(() => {
          content.forEach(line => {
            if (line.trim()) {
              terminal.writeln(line);
            }
          });
          
          // Force a complete refresh
          terminal.refresh(0, terminal.rows - 1);
        }, 50);
        
        console.log('Applied new theme:', newTheme);
      }

      // Apply font settings if provided
      if (options.appearance?.font) {
        const font = options.appearance.font;
        if (font.family) {
          terminal.options.fontFamily = `"${font.family}", "Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Menlo, "Ubuntu Mono", monospace`;
        }
        if (font.size) {
          terminal.options.fontSize = font.size;
        }
        if (font.weight) {
          terminal.options.fontWeight = font.weight as any;
        }
        if (font.lineHeight) {
          terminal.options.lineHeight = font.lineHeight;
        }
        
        // Force font changes to take effect
        if (fitAddonRef.current) {
          setTimeout(() => {
            fitAddonRef.current?.fit();
            terminal.refresh(0, terminal.rows - 1);
          }, 100);
        }
        
        console.log('Applied font settings:', font);
      }

      // Apply cursor settings if provided
      if (options.appearance?.cursor) {
        const cursor = options.appearance.cursor;
        if (cursor.style) {
          terminal.options.cursorStyle = cursor.style;
        }
        if (cursor.blink !== undefined) {
          terminal.options.cursorBlink = cursor.blink;
        }
        
        // Force cursor changes to take effect
        terminal.refresh(0, terminal.rows - 1);
        
        console.log('Applied cursor settings:', cursor);
      }

      // Apply scrollback if provided
      if (options.appearance?.scrollback) {
        terminal.options.scrollback = options.appearance.scrollback;
        console.log('Applied scrollback:', options.appearance.scrollback);
      }

      console.log('Options applied successfully');
    } catch (error) {
      console.error('Error applying terminal options:', error);
    }
  }, []);

  // Initialize XTerm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    // Simple options loading (synchronous)
    let savedOptions: any = {};
    try {
      const savedOptionsStr = localStorage.getItem('terminalOptions');
      if (savedOptionsStr) {
        savedOptions = JSON.parse(savedOptionsStr);
      }
    } catch (error) {
      console.error('Error loading terminal options:', error);
    }
    console.log('Loaded options:', savedOptions);

    // Apply saved options to default theme
    const defaultTheme = {
      background: '#1a1a2e',
      foreground: '#e0e7ff',
      cursor: '#8b5cf6',
      cursorAccent: '#1a1a2e',
      selectionBackground: '#6366f1',
      black: '#0f1419',
      red: '#ef4444',
      green: '#10b981',
      yellow: '#f59e0b',
      blue: '#3b82f6',
      magenta: '#8b5cf6',
      cyan: '#06b6d4',
      white: '#e0e7ff',
      brightBlack: '#8b8db8',
      brightRed: '#f87171',
      brightGreen: '#34d399',
      brightYellow: '#fbbf24',
      brightBlue: '#60a5fa',
      brightMagenta: '#a855f7',
      brightCyan: '#22d3ee',
      brightWhite: '#ffffff'
    };

    // Merge saved theme with default
    const theme = savedOptions.appearance?.theme ? 
      { ...defaultTheme, ...savedOptions.appearance.theme } : 
      defaultTheme;

    // Get font settings
    const font = savedOptions.appearance?.font || {};
    const cursor = savedOptions.appearance?.cursor || {};

    console.log('Applied theme:', theme);
    console.log('Applied font:', font);

    // Create terminal instance with applied options
    const terminal = new XTerm({
      theme,
      fontFamily: font.family ? 
        `"${font.family}", "Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Menlo, "Ubuntu Mono", monospace` : 
        '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Menlo, "Ubuntu Mono", monospace',
      fontSize: font.size || 14,
      fontWeight: font.weight || 'normal',
      lineHeight: font.lineHeight || 1.2,
      cursorBlink: cursor.blink !== undefined ? cursor.blink : true,
      cursorStyle: cursor.style || 'block',
      scrollback: savedOptions.appearance?.scrollback || 10000,
      tabStopWidth: 4,
      allowTransparency: false,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      wordSeparator: ' ()[]{}\'"`'
    })

    // Create addons
    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    const searchAddon = new SearchAddon()

    // Load addons
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(searchAddon)

    // Open terminal
    terminal.open(terminalRef.current!)

    // Store references
    xtermRef.current = terminal
    fitAddonRef.current = fitAddon
    searchAddonRef.current = searchAddon

    // Apply background color to the container after terminal is opened
    if (theme.background && terminalRef.current) {
      terminalRef.current.style.backgroundColor = theme.background;
      // Also apply to the xterm viewport
      setTimeout(() => {
        const viewport = terminalRef.current?.querySelector('.xterm-viewport') as HTMLElement;
        const screen = terminalRef.current?.querySelector('.xterm-screen') as HTMLElement;
        if (viewport) {
          viewport.style.backgroundColor = theme.background;
        }
        if (screen) {
          screen.style.backgroundColor = theme.background;
        }
      }, 100);
    }

    // Fit terminal to container
    fitAddon.fit()

    // Set the saved options to state
    setTerminalOptions(savedOptions);

    // Handle data input from user - use ref to get current sessionId
    terminal.onData((data) => {
      const currentSessionId = sessionIdRef.current
      console.log(`Terminal input: sessionId=${currentSessionId}, data="${data}"`)
      
      // Allow input if we have a sessionId (even if still connecting) and it's not null
      if (!currentSessionId || currentSessionId === null) {
        console.log('Terminal input blocked: no valid sessionId')
        return
      }

      // Send data to SSH session - this will work for both connected and connecting sessions
      if (window.electronAPI?.sshWrite) {
        console.log(`Sending SSH data to session ${currentSessionId}`)
        window.electronAPI.sshWrite(currentSessionId, data)
      } else {
        console.log('SSH write API not available')
      }
    })

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      if (sessionId && sessionId !== null && (window as any).electronAPI?.sshResize) {
        (window as any).electronAPI.sshResize(sessionId, cols, rows)
      }
    })

    // Handle selection for copy/paste
    terminal.onSelectionChange(() => {
      const selection = terminal.getSelection()
      if (selection) {
        // Store selection for context menu
      }
    })

    // Cleanup
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
        searchAddonRef.current = null
      }
    }
  }, []) // Remove isConnected and sessionId from dependencies to prevent recreation

  // Get current command line from terminal
  const getCurrentCommandLine = useCallback((terminal: XTerm): string => {
    const buffer = terminal.buffer.active
    const currentLine = buffer.getLine(buffer.cursorY)
    if (!currentLine) return ''

    const lineText = currentLine.translateToString(true)
    
    // Extract working directory from prompt and command
    const pathPromptMatch = lineText.match(/[^:]*:([^$#>]+)[$#>]\s*(.*)$/)
    if (pathPromptMatch) {
      const detectedPath = pathPromptMatch[1].trim()
      if (detectedPath && detectedPath !== '~' && detectedPath.startsWith('/')) {
        setCurrentWorkingDirectory(detectedPath)
      }
      return pathPromptMatch[2].trim()
    }

    // Fallback: find command after prompt
    const promptMatch = lineText.match(/[\$#>]\s*(.*)$/)
    return promptMatch ? promptMatch[1].trim() : ''
  }, [])

  // Handle editor commands
  const handleEditorCommand = useCallback(async (command: string): Promise<boolean> => {
    const trimmedCommand = command.trim()
    if (!trimmedCommand) return false

    // Define editor commands
    const editorPatterns = [
      /^nano\s+(.+)$/,
      /^vim\s+(.+)$/,
      /^vi\s+(.+)$/,
      /^emacs\s+(.+)$/,
      /^code\s+(.+)$/,
      /^edit\s+(.+)$/,
      /^gedit\s+(.+)$/,
      /^kate\s+(.+)$/
    ]

    for (const pattern of editorPatterns) {
      const match = trimmedCommand.match(pattern)
      if (match) {
        const filePath = match[1].trim().replace(/^["']|["']$/g, '')
        
        // Get current working directory
        let actualCwd = currentWorkingDirectory
        try {
          if (window.electronAPI && 'sshExecuteCommand' in window.electronAPI && sessionId) {
            const result = await (window.electronAPI as any).sshExecuteCommand(sessionId, 'pwd')
            if (result.success && result.output) {
              actualCwd = result.output.trim()
              setCurrentWorkingDirectory(actualCwd)
            }
          }
        } catch (error) {
          console.error('Error getting current directory:', error)
        }

        // Resolve path
        const absolutePath = filePath.startsWith('/') 
          ? filePath 
          : `${actualCwd}/${filePath}`

        // Dispatch event to open file editor
        const event = new CustomEvent('ai-open-file-editor', {
          detail: { 
            filepath: absolutePath, 
            reason: `Editing file via ${trimmedCommand.split(' ')[0]} command` 
          }
        })
        window.dispatchEvent(event)

        console.log(`Editor command intercepted: ${trimmedCommand} -> ${absolutePath}`)
        
        // Send newline to show command was "executed"
        if (xtermRef.current) {
          xtermRef.current.write('\r\n')
        }
        
        return true
      }
    }

    return false
  }, [currentWorkingDirectory, sessionId])

  // Handle SSH data using the centralized handler system
  useEffect(() => {
    if (!sessionId || sessionId === null || !xtermRef.current || !onRegisterHandler) return

    const handleSSHData = (data: string) => {
      if (xtermRef.current && isVisible) {
        xtermRef.current.write(data)
      }
    }

    // Register this terminal's handler with the parent
    onRegisterHandler(sessionId, handleSSHData)

    return () => {
      // Unregister handler when component unmounts or sessionId changes
      if (onUnregisterHandler) {
        onUnregisterHandler(sessionId)
      }
    }
  }, [sessionId, isVisible, onRegisterHandler, onUnregisterHandler])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && isVisible) {
        fitAddonRef.current.fit()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isVisible])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!xtermRef.current || !isVisible) return

      // Ctrl+, - Open terminal options
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault()
        setIsOptionsModalOpen(true)
        return
      }

      // Ctrl+C - Copy selection
      if (e.ctrlKey && e.key === 'c' && xtermRef.current.hasSelection()) {
        e.preventDefault()
        const selection = xtermRef.current.getSelection()
        if (selection && window.electronAPI?.clipboardWriteText) {
          window.electronAPI.clipboardWriteText(selection)
        }
        return
      }

      // Ctrl+V - Paste
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault()
        if (window.electronAPI?.clipboardReadText) {
          window.electronAPI.clipboardReadText().then((text) => {
            if (text && xtermRef.current && window.electronAPI?.sshWrite && sessionId) {
              window.electronAPI.sshWrite(sessionId, text)
            }
          })
        }
        return
      }

      // Ctrl+F - Search
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault()
        if (searchAddonRef.current) {
          // You can implement a search UI here
          const searchTerm = prompt('Search in terminal:')
          if (searchTerm) {
            searchAddonRef.current.findNext(searchTerm)
          }
        }
        return
      }

      // Ctrl+Shift+C - Force copy (alternative)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        const selection = xtermRef.current.getSelection()
        if (selection && window.electronAPI?.clipboardWriteText) {
          window.electronAPI.clipboardWriteText(selection)
        }
        return
      }

      // Ctrl+Shift+V - Force paste (alternative)
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        if (window.electronAPI?.clipboardReadText) {
          window.electronAPI.clipboardReadText().then((text) => {
            if (text && xtermRef.current && window.electronAPI?.sshWrite && sessionId) {
              window.electronAPI.sshWrite(sessionId, text)
            }
          })
        }
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isConnected, sessionId, isVisible])

  // Focus terminal when visible and available
  useEffect(() => {
    if (isVisible && xtermRef.current && !isOptionsModalOpen) {
      xtermRef.current.focus()
    }
  }, [isVisible, isOptionsModalOpen])

  // Show welcome screen only when no session exists and not connected
  const shouldShowWelcome = (!sessionId || sessionId === null) && !isConnected
  
  if (shouldShowWelcome) {
    return (
      <div className="terminal-container">
        <div className="terminal-welcome">
          <div className="terminal-logo">
            <img 
              src="./src/assets/logo_2.png" 
              alt="GraphLinq Terminal" 
              width="250" 
              height="250"
            />
          </div>
        </div>
      </div>
    )
  }

  // Show connecting state for sessions that are being established
  if (!isConnected && sessionId === '') {
    return (
      <div className="terminal-container">
        <div className="terminal-connecting">
          <div className="connecting-spinner">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="18" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" values="0 16 16;360 16 16" dur="1s" repeatCount="indefinite"/>
              </circle>
            </svg>
          </div>
          <p>Connecting to server...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="terminal-container">
      {/* Terminal options button */}
      <button 
        className="terminal-settings-icon"
        onClick={() => setIsOptionsModalOpen(true)}
        title="Terminal Options (Ctrl+,)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>
      </button>

      <div 
        ref={terminalRef} 
        className="xterm-container"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Terminal options modal */}
      <TerminalOptionsModal 
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        onOptionsChange={handleOptionsChange}
      />
    </div>
  )
}

export default Terminal 