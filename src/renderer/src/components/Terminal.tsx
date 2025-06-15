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
}

const Terminal: React.FC<TerminalProps> = ({ sessionId, isConnected, onDisconnect }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState<boolean>(false)
  const [currentWorkingDirectory, setCurrentWorkingDirectory] = useState<string>('/home')
  const [terminalOptions, setTerminalOptions] = useState<TerminalOptions>({})

  // Load terminal options
  const loadTerminalOptions = useCallback(async (): Promise<TerminalOptions> => {
    let options: TerminalOptions = {};
    
    if (window.electronAPI?.getTerminalOptions) {
      options = await window.electronAPI.getTerminalOptions();
    } else {
      const savedOptions = localStorage.getItem('terminalOptions');
      if (savedOptions) {
        options = JSON.parse(savedOptions);
      }
    }
    
    return options;
  }, []);

  // Get terminal theme from options
  const getTerminalTheme = useCallback((options: TerminalOptions) => {
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

    if (options.appearance?.theme) {
      return {
        ...defaultTheme,
        ...options.appearance.theme,
        cursorAccent: options.appearance.theme.background || defaultTheme.background,
        // Generate bright colors based on base colors
        brightBlack: '#8b8db8',
        brightRed: options.appearance.theme.red ? lightenColor(options.appearance.theme.red, 20) : defaultTheme.brightRed,
        brightGreen: options.appearance.theme.green ? lightenColor(options.appearance.theme.green, 20) : defaultTheme.brightGreen,
        brightYellow: options.appearance.theme.yellow ? lightenColor(options.appearance.theme.yellow, 20) : defaultTheme.brightYellow,
        brightBlue: options.appearance.theme.blue ? lightenColor(options.appearance.theme.blue, 20) : defaultTheme.brightBlue,
        brightMagenta: options.appearance.theme.magenta ? lightenColor(options.appearance.theme.magenta, 20) : defaultTheme.brightMagenta,
        brightCyan: options.appearance.theme.cyan ? lightenColor(options.appearance.theme.cyan, 20) : defaultTheme.brightCyan,
        brightWhite: '#ffffff'
      };
    }

    return defaultTheme;
  }, []);

  // Helper function to lighten colors
  const lightenColor = (color: string, percent: number): string => {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  };

  // Apply terminal options to existing terminal
  const applyTerminalOptions = useCallback((options: TerminalOptions) => {
    if (!xtermRef.current) return;

    const terminal = xtermRef.current;
    
    // Apply theme
    const theme = getTerminalTheme(options);
    terminal.options.theme = theme;

    // Apply font settings
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
    }

    // Apply cursor settings
    if (options.appearance?.cursor) {
      const cursor = options.appearance.cursor;
      if (cursor.style) {
        terminal.options.cursorStyle = cursor.style;
      }
      if (cursor.blink !== undefined) {
        terminal.options.cursorBlink = cursor.blink;
      }
    }

    // Apply scrollback
    if (options.appearance?.scrollback) {
      terminal.options.scrollback = options.appearance.scrollback;
    }

    // Refresh terminal to apply changes
    terminal.refresh(0, terminal.rows - 1);
    
    // Fit terminal after applying options
    if (fitAddonRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
    }
  }, [getTerminalTheme]);

  // Handle options change from modal
  const handleOptionsChange = useCallback((options: TerminalOptions) => {
    setTerminalOptions(options);
    applyTerminalOptions(options);
  }, [applyTerminalOptions]);

  // Initialize XTerm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    const initializeTerminal = async () => {
      // Create terminal instance with default options
      const terminal = new XTerm({
        theme: {
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
        },
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", "SF Mono", Monaco, Menlo, "Ubuntu Mono", monospace',
        fontSize: 14,
        fontWeight: 'normal',
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 10000,
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

      // Fit terminal to container
      fitAddon.fit()

      // Handle data input from user
      terminal.onData((data) => {
        if (!isConnected || !sessionId) return

        // Send data to SSH session
        if (window.electronAPI?.sshWrite) {
          window.electronAPI.sshWrite(sessionId, data)
        }
      })

      // Handle terminal resize
      terminal.onResize(({ cols, rows }) => {
        if (sessionId && isConnected && (window as any).electronAPI?.sshResize) {
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
    };

    initializeTerminal();

    // Cleanup
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose()
        xtermRef.current = null
        fitAddonRef.current = null
        searchAddonRef.current = null
      }
    }
  }, [isConnected, sessionId])

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

  // Handle SSH data
  useEffect(() => {
    if (!sessionId || !isConnected || !xtermRef.current) return

    const handleSSHData = (receivedSessionId: string, data: string) => {
      if (receivedSessionId === sessionId && xtermRef.current) {
        xtermRef.current.write(data)
      }
    }

    // Clean up existing listeners
    if ((window as any).electronAPI?.offSSHData) {
      (window as any).electronAPI.offSSHData()
    }

    // Add new listener
    if ((window as any).electronAPI?.onSSHData) {
      (window as any).electronAPI.onSSHData(handleSSHData)
    }

    return () => {
      if ((window as any).electronAPI?.offSSHData) {
        (window as any).electronAPI.offSSHData()
      }
    }
  }, [sessionId, isConnected])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!xtermRef.current || !isConnected) return

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
  }, [isConnected, sessionId])

  // Focus terminal when connected
  useEffect(() => {
    if (isConnected && xtermRef.current && !isOptionsModalOpen) {
      xtermRef.current.focus()
    }
  }, [isConnected, isOptionsModalOpen])

  if (!isConnected) {
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

  return (
    <div className="terminal-container">
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