import React, { useEffect, useRef, useState, useCallback, memo, useMemo } from 'react'
import './Terminal.scss'
import TerminalContextMenu from './TerminalContextMenu'
import TerminalOptionsModal from './TerminalOptionsModal'
import { BsStar, BsStarFill } from 'react-icons/bs'
import { IoSettingsOutline } from 'react-icons/io5'

interface TerminalProps {
  sessionId: string | null
  isConnected: boolean
  onDisconnect: () => void
}

interface TerminalState {
  buffer: TerminalChar[][]
  cursorRow: number
  cursorCol: number
  rows: number
  cols: number
  currentStyle: TerminalStyle
  alternateBuffer: TerminalChar[][] | null
  savedCursor: { row: number; col: number; style: TerminalStyle } | null
  isAlternateScreen: boolean
  lastPromptRow: number
  scrollTop: number
  scrollRegionTop: number
  scrollRegionBottom: number
  isEditingCommand: boolean
  lastCommandRow: number
  recentCursorMoves: number
  lastDataTime: number
  lineRewriteInProgress: boolean
  maxLineLength: number
  renderKey: number
  selectionStart: { row: number; col: number } | null
  selectionEnd: { row: number; col: number } | null
  isSelecting: boolean
  contextMenuPosition: { x: number; y: number } | null
  isAIWriting: boolean
  aiWritingCommand: string | null
  aiWritingDescription: string | null
  aiExplanationText: string | null
  aiTypingPosition: { row: number; col: number } | null
  scrollOffset: number
  maxBufferSize: number
}

interface TerminalChar {
  char: string
  style: TerminalStyle
}

interface TerminalStyle {
  fg: string
  bg: string
  bold: boolean
  dim: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  reverse: boolean
}

const defaultStyle: TerminalStyle = {
  fg: '#cccccc',
  bg: 'transparent',
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strikethrough: false,
  reverse: false
}

// ANSI color mapping
const ansiColors: { [key: number]: string } = {
  0: '#000000',   // Black
  1: '#cd3131',   // Red
  2: '#0dbc79',   // Green
  3: '#e5e510',   // Yellow
  4: '#2472c8',   // Blue
  5: '#bc3fbc',   // Magenta
  6: '#11a8cd',   // Cyan
  7: '#e5e5e5',   // White
  8: '#666666',   // Bright Black
  9: '#f14c4c',   // Bright Red
  10: '#23d18b',  // Bright Green
  11: '#f5f543',  // Bright Yellow
  12: '#3b8eea',  // Bright Blue
  13: '#d670d6',  // Bright Magenta
  14: '#29b8db',  // Bright Cyan
  15: '#ffffff'   // Bright White
}

// Component interfaces
interface TerminalCharProps {
  char: TerminalChar
  isCursor: boolean
  isSelected: boolean
}

interface TerminalRowProps {
  row: TerminalChar[]
  rowIndex: number
  cursorRow: number
  cursorCol: number
  isCellSelected: (row: number, col: number) => boolean
  actualBufferRow: number
}

// Optimized character component with better comparison
const TerminalCharComponent = memo<TerminalCharProps>(({ char, isCursor, isSelected }) => {
  // Memoize style calculation with better performance
  const finalStyle = useMemo(() => {
    const style = char.style;
    
    // Base style object - reuse common properties
    const baseStyle = {
      fontWeight: style.bold ? 'bold' : 'normal',
      fontStyle: style.italic ? 'italic' : 'normal',
      opacity: style.dim ? 0.5 : 1
    };
    
    // Handle text decoration efficiently
    let textDecoration = 'none';
    if (style.underline || style.strikethrough) {
      const decorations = [];
      if (style.underline) decorations.push('underline');
      if (style.strikethrough) decorations.push('line-through');
      textDecoration = decorations.join(' ');
    }
    
    // Apply reverse video if needed
    let computedStyle;
    if (style.reverse) {
      computedStyle = {
        ...baseStyle,
        color: style.bg !== 'transparent' ? style.bg : '#1e1e1e',
        backgroundColor: style.fg,
        textDecoration
      };
    } else {
      computedStyle = {
        ...baseStyle,
        color: style.fg,
        backgroundColor: style.bg,
        textDecoration
      };
    }
    
    // Apply selection style (override background) - let CSS handle the styling
    if (isSelected) {
      // Use a more subtle inline style that works with CSS
      computedStyle.backgroundColor = 'rgba(95, 31, 138, 0.4)';
      computedStyle.color = '#ffffff';
    }
    
    return computedStyle;
  }, [char.style, isSelected]);
  
  // Optimize className generation
  const className = useMemo(() => {
    let classes = 'terminal-char';
    if (isCursor) classes += ' cursor';
    if (isSelected) classes += ' selected';
    return classes;
  }, [isCursor, isSelected]);
  
  return (
    <span className={className} style={finalStyle}>
      {char.char === ' ' ? '\u00A0' : char.char}
    </span>
  );
}, (prevProps, nextProps) => {
  // Fast equality check - most common case
  if (prevProps.char === nextProps.char && 
      prevProps.isCursor === nextProps.isCursor &&
      prevProps.isSelected === nextProps.isSelected) {
    return true;
  }
  
  // Only do deep comparison if necessary
  if (prevProps.isCursor !== nextProps.isCursor ||
      prevProps.isSelected !== nextProps.isSelected) {
    return false;
  }
  
  // Deep comparison for char content and style
  const prevChar = prevProps.char;
  const nextChar = nextProps.char;
  
  return prevChar.char === nextChar.char && 
         prevChar.style.fg === nextChar.style.fg &&
         prevChar.style.bg === nextChar.style.bg &&
         prevChar.style.bold === nextChar.style.bold &&
         prevChar.style.dim === nextChar.style.dim &&
         prevChar.style.italic === nextChar.style.italic &&
         prevChar.style.underline === nextChar.style.underline &&
         prevChar.style.strikethrough === nextChar.style.strikethrough &&
         prevChar.style.reverse === nextChar.style.reverse;
})

// Optimized row component with better memoization
const TerminalRow = memo<TerminalRowProps>(({ 
  row, 
  rowIndex, 
  cursorRow, 
  cursorCol, 
  isCellSelected,
  actualBufferRow
}) => {
  // Memoize row rendering with optimized dependencies
  const rowContent = useMemo(() => {
    const hasCursor = rowIndex === cursorRow;
    
    return row.map((char, colIndex) => {
      const isCursor = hasCursor && colIndex === cursorCol;
      const isSelected = actualBufferRow >= 0 ? isCellSelected(actualBufferRow, colIndex) : false;
      
      return (
        <TerminalCharComponent
          key={colIndex}
          char={char}
          isCursor={isCursor}
          isSelected={isSelected}
        />
      );
    });
  }, [row, rowIndex, cursorRow, cursorCol, isCellSelected, actualBufferRow]);
  
  return (
    <div className="terminal-row">
      {rowContent}
    </div>
  )
}, (prevProps, nextProps) => {
  // Optimized memoization - only re-render when necessary
  if (prevProps.row !== nextProps.row ||
      prevProps.cursorRow !== nextProps.cursorRow ||
      prevProps.cursorCol !== nextProps.cursorCol ||
      prevProps.actualBufferRow !== nextProps.actualBufferRow) {
    return false;
  }
  
  // Check if selection state might have changed for this row
  const hasSelection = nextProps.isCellSelected !== prevProps.isCellSelected;
  if (hasSelection) {
    return false;
  }
  
  return true;
})

const Terminal: React.FC<TerminalProps> = ({ sessionId, isConnected, onDisconnect }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [terminalState, setTerminalState] = useState<TerminalState>({
    buffer: [],
    cursorRow: 0,
    cursorCol: 0,
    rows: 24,
    cols: 80,
    currentStyle: defaultStyle,
    alternateBuffer: null,
    savedCursor: null,
    isAlternateScreen: false,
    lastPromptRow: 0,
    scrollTop: 0,
    scrollRegionTop: 0,
    scrollRegionBottom: 23,
    isEditingCommand: false,
    lastCommandRow: 0,
    recentCursorMoves: 0,
    lastDataTime: 0,
    lineRewriteInProgress: false,
    maxLineLength: 0,
    renderKey: 0,
    selectionStart: null,
    selectionEnd: null,
    isSelecting: false,
    contextMenuPosition: null,
    isAIWriting: false,
    aiWritingCommand: null,
    aiWritingDescription: null,
    aiExplanationText: null,
    aiTypingPosition: null,
    scrollOffset: 0,
    maxBufferSize: 10000
  })
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState<boolean>(false);

  // Initialize terminal buffer with proper dimensions
  const initializeBuffer = useCallback((rows: number, cols: number) => {
    // Start with just the visible rows, buffer will grow as needed
    const buffer = Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
    )
    return buffer
  }, [])

  // Add a new line to buffer, managing history
  const addLineToBuffer = useCallback((buffer: TerminalChar[][], cols: number, maxHistory: number = 10000) => {
    // Add a new empty line at the end
    const newLine = Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
    const newBuffer = [...buffer, newLine]
    
    // Trim buffer if it exceeds max history
    if (newBuffer.length > maxHistory) {
      return newBuffer.slice(newBuffer.length - maxHistory)
    }
    
    return newBuffer
  }, [])



  // Handle scroll in terminal history with better performance
  const handleScroll = useCallback((direction: 'up' | 'down', amount: number = 3) => {
    setTerminalState(prev => {
      // Maximum scroll is buffer length minus visible rows
      const maxScrollOffset = Math.max(0, prev.buffer.length - prev.rows)
      let newScrollOffset = prev.scrollOffset
      
      if (direction === 'up') {
        newScrollOffset = Math.min(maxScrollOffset, prev.scrollOffset + amount)
      } else {
        newScrollOffset = Math.max(0, prev.scrollOffset - amount)
      }
      
      // Debug scroll
      console.log('Scroll:', { direction, amount, current: prev.scrollOffset, new: newScrollOffset, max: maxScrollOffset, bufferLength: prev.buffer.length });
      
      // Only update if scrollOffset actually changes
      if (newScrollOffset === prev.scrollOffset) {
        return prev
      }
      
      return {
        ...prev,
        scrollOffset: newScrollOffset
      }
    })
  }, [])

  // Debounced scroll for smoother performance
  const debouncedScroll = useCallback((direction: 'up' | 'down', amount: number = 3) => {
    handleScroll(direction, amount)
  }, [handleScroll])

  // Handle mouse wheel scroll with proper event handling
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      // Determine scroll direction and amount
      const direction = e.deltaY > 0 ? 'down' : 'up';
      const amount = Math.abs(e.deltaY) > 50 ? 5 : 3;
      
      // Use timeout to batch scroll events for better performance
      scrollTimeout = setTimeout(() => {
        debouncedScroll(direction, amount);
      }, 16); // ~60fps
    };

    // Add wheel listener with non-passive option
    terminal.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      terminal.removeEventListener('wheel', handleWheel);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [debouncedScroll]);

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isConnected || !sessionId) return

    // Ignorer les événements clavier uniquement si la modal des options est ouverte
    if (isOptionsModalOpen) return
    
    // Handle scroll keys first (Page Up/Down, Shift+Arrow keys)
    if (e.key === 'PageUp') {
      e.preventDefault();
      debouncedScroll('up', 10);
      return;
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      debouncedScroll('down', 10);
      return;
    } else if (e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      debouncedScroll('up', 1);
      return;
    } else if (e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      debouncedScroll('down', 1);
      return;
    }
    
    // Reset scroll to bottom when user types (except for scroll commands)
    if (terminalState.scrollOffset > 0 && 
        !['PageUp', 'PageDown'].includes(e.key) && 
        !(e.shiftKey && ['ArrowUp', 'ArrowDown'].includes(e.key))) {
      setTerminalState(prev => ({
        ...prev,
        scrollOffset: 0
      }));
    }
    
    e.preventDefault();

    let dataToSend = ''

    if (e.key === 'Enter') {
      dataToSend = '\r'
    } else if (e.key === 'Backspace') {
      dataToSend = '\b'
    } else if (e.key === 'Tab') {
      dataToSend = '\t'
    } else if (e.key === 'ArrowUp') {
      dataToSend = '\x1b[A'
    } else if (e.key === 'ArrowDown') {
      dataToSend = '\x1b[B'
    } else if (e.key === 'ArrowRight') {
      dataToSend = '\x1b[C'
    } else if (e.key === 'ArrowLeft') {
      dataToSend = '\x1b[D'
    } else if (e.key === 'Home') {
      dataToSend = '\x1b[H'
    } else if (e.key === 'End') {
      dataToSend = '\x1b[F'
    } else if (e.key === 'Delete') {
      dataToSend = '\x1b[3~'
    } else if (e.key === 'Insert') {
      dataToSend = '\x1b[2~'
    } else if (e.key === 'F1') {
      dataToSend = '\x1bOP'
    } else if (e.key === 'F2') {
      dataToSend = '\x1bOQ'
    } else if (e.key === 'F3') {
      dataToSend = '\x1bOR'
    } else if (e.key === 'F4') {
      dataToSend = '\x1bOS'
    } else if (e.key === 'F5') {
      dataToSend = '\x1b[15~'
    } else if (e.key === 'F6') {
      dataToSend = '\x1b[17~'
    } else if (e.key === 'F7') {
      dataToSend = '\x1b[18~'
    } else if (e.key === 'F8') {
      dataToSend = '\x1b[19~'
    } else if (e.key === 'F9') {
      dataToSend = '\x1b[20~'
    } else if (e.key === 'F10') {
      dataToSend = '\x1b[21~'
    } else if (e.key === 'F11') {
      dataToSend = '\x1b[23~'
    } else if (e.key === 'F12') {
      dataToSend = '\x1b[24~'
    } else if (e.ctrlKey && e.key === 'c') {
      dataToSend = '\x03'
    } else if (e.ctrlKey && e.key === 'd') {
      dataToSend = '\x04'
    } else if (e.ctrlKey && e.key === 'z') {
      dataToSend = '\x1a'
    } else if (e.ctrlKey && e.key === 'l') {
      dataToSend = '\x0c'
    } else if (e.ctrlKey && e.key === 'a') {
      dataToSend = '\x01'
    } else if (e.ctrlKey && e.key === 'e') {
      dataToSend = '\x05'
    } else if (e.ctrlKey && e.key === 'k') {
      dataToSend = '\x0b'
    } else if (e.ctrlKey && e.key === 'u') {
      dataToSend = '\x15'
    } else if (e.ctrlKey && e.key === 'w') {
      dataToSend = '\x17'
    } else if (e.ctrlKey && e.key === 'r') {
      dataToSend = '\x12'
    } else if (e.ctrlKey && e.key === 's') {
      dataToSend = '\x13'
    } else if (e.ctrlKey && e.key === 'q') {
      dataToSend = '\x11'
    } else if (e.altKey && e.key.length === 1) {
      // Alt + character combinations
      dataToSend = '\x1b' + e.key.toLowerCase()
    } else if (e.key === 'Escape') {
      dataToSend = '\x1b'
    } else if (e.key.length === 1) {
      dataToSend = e.key
    }

    if (dataToSend && window.electronAPI?.sshWrite) {
      window.electronAPI.sshWrite(sessionId, dataToSend)
    }
  }, [isConnected, sessionId, isOptionsModalOpen])

  // Memoize selection bounds for better performance
  const selectionBounds = useMemo(() => {
    if (!terminalState.selectionStart || !terminalState.selectionEnd) return null;

    const { selectionStart, selectionEnd } = terminalState;
    
    // Déterminer l'ordre de la sélection (début et fin)
    if (selectionStart.row < selectionEnd.row || 
        (selectionStart.row === selectionEnd.row && selectionStart.col <= selectionEnd.col)) {
      return {
        startRow: selectionStart.row,
        startCol: selectionStart.col,
        endRow: selectionEnd.row,
        endCol: selectionEnd.col
      };
    } else {
      return {
        startRow: selectionEnd.row,
        startCol: selectionEnd.col,
        endRow: selectionStart.row,
        endCol: selectionStart.col
      };
    }
  }, [terminalState.selectionStart, terminalState.selectionEnd]);

  // Déterminer si une cellule fait partie de la sélection
  const isCellSelected = useCallback((row: number, col: number) => {
    if (!selectionBounds) return false;

    const { startRow, startCol, endRow, endCol } = selectionBounds;
    
    // Vérifier si la cellule est dans la plage de sélection
    if (row < startRow || row > endRow) {
      return false;
    }
    
    if (startRow === endRow) {
      // Sélection sur une seule ligne
      return col >= startCol && col <= endCol;
    } else if (row === startRow) {
      // Première ligne de la sélection
      return col >= startCol;
    } else if (row === endRow) {
      // Dernière ligne de la sélection
      return col <= endCol;
    } else {
      // Lignes intermédiaires - toute la ligne est sélectionnée
      return true;
    }
  }, [selectionBounds])

  // Obtenir le texte sélectionné
  const getSelectedText = useCallback(() => {
    if (!terminalState.selectionStart || !terminalState.selectionEnd) return ''

    const { selectionStart, selectionEnd } = terminalState;
    
    // Déterminer l'ordre de la sélection (début et fin)
    let startRow, startCol, endRow, endCol;
    
    if (selectionStart.row < selectionEnd.row || 
        (selectionStart.row === selectionEnd.row && selectionStart.col <= selectionEnd.col)) {
      // Sélection normale
      startRow = selectionStart.row;
      startCol = selectionStart.col;
      endRow = selectionEnd.row;
      endCol = selectionEnd.col;
    } else {
      // Sélection inversée
      startRow = selectionEnd.row;
      startCol = selectionEnd.col;
      endRow = selectionStart.row;
      endCol = selectionStart.col;
    }

    // Extraire le texte
    const buffer = terminalState.isAlternateScreen && terminalState.alternateBuffer 
      ? terminalState.alternateBuffer 
      : terminalState.buffer

    let text = ''
    
    for (let row = startRow; row <= endRow; row++) {
      if (!buffer[row]) continue

      const rowStartCol = (row === startRow) ? startCol : 0
      const rowEndCol = (row === endRow) ? endCol : (buffer[row].length - 1)
      
      let rowText = ''
      for (let col = rowStartCol; col <= rowEndCol; col++) {
        if (buffer[row][col]) {
          rowText += buffer[row][col].char
        }
      }
      
      // Supprimer les espaces en fin de ligne sauf si c'est la dernière ligne
      if (row < endRow) {
        text += rowText.trimEnd() + '\n'
      } else {
        text += rowText
      }
    }
    
    return text
  }, [terminalState.selectionStart, terminalState.selectionEnd, terminalState.buffer, terminalState.alternateBuffer, terminalState.isAlternateScreen])

  // Copier le texte sélectionné
  const handleCopy = useCallback(async () => {
    const text = getSelectedText().trim()

    console.log('Texte à copier:', text)
    
    if (text && text.length > 0) {
      try {
        // Utiliser l'API Electron clipboard au lieu de navigator.clipboard
        if (window.electronAPI?.clipboardWriteText) {
          await window.electronAPI.clipboardWriteText(text)
          console.log('Texte copié:', text.length > 50 ? text.substring(0, 50) + '...' : text)
        } else {
          console.error('API clipboardWriteText non disponible')
        }
      } catch (err) {
        console.error('Erreur lors de la copie du texte:', err)
      }
    }
    
    // Fermer le menu contextuel et effacer la sélection
    setTerminalState(prev => ({
      ...prev,
      contextMenuPosition: null,
      selectionStart: null,
      selectionEnd: null
    }))
  }, [getSelectedText])

  // Coller le texte du presse-papier
  const handlePaste = useCallback(async () => {
    if (!isConnected || !sessionId) return
    
    try {
      // Utiliser l'API Electron clipboard au lieu de navigator.clipboard
      if (window.electronAPI?.clipboardReadText && window.electronAPI?.sshWrite) {
        const text = await window.electronAPI.clipboardReadText()
        
        if (text) {
          await window.electronAPI.sshWrite(sessionId, text)
          console.log('Texte collé, longueur:', text.length)
        }
      } else {
        console.error('API clipboardReadText ou sshWrite non disponible')
      }
    } catch (err) {
      console.error('Erreur lors de la lecture du presse-papier:', err)
    }
    
    // Fermer le menu contextuel
    setTerminalState(prev => ({
      ...prev,
      contextMenuPosition: null
    }))
  }, [isConnected, sessionId])

  // Gestionnaire de menu contextuel (clic droit)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    console.log('Menu contextuel ouvert à', e.clientX, e.clientY)
    
    setTerminalState(prev => ({
      ...prev,
      contextMenuPosition: { x: e.clientX, y: e.clientY }
    }))
  }, [])

  // Fermer le menu contextuel
  const handleCloseContextMenu = useCallback(() => {
    setTerminalState(prev => ({
      ...prev,
      contextMenuPosition: null
    }))
  }, [])

  // Ouvrir la modal des options
  const handleOpenOptions = useCallback(() => {
    handleCloseContextMenu();
    setIsOptionsModalOpen(true);
  }, [handleCloseContextMenu]);

  // Ajouter un gestionnaire pour fermer le menu contextuel lors d'un clic en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (terminalState.contextMenuPosition) {
        handleCloseContextMenu()
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [terminalState.contextMenuPosition, handleCloseContextMenu])

  // Modifier le gestionnaire de clavier global pour tenir compte de la modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Si le terminal n'est pas connecté ou si la modal est ouverte, ignorer
      if (!isConnected || !sessionId) return;
      
      // Ignorer les événements quand la modal est ouverte, mais ne pas bloquer le reste du temps
      if (isOptionsModalOpen) return;
      
      console.log('Global keydown:', e.key, 'Ctrl:', e.ctrlKey);
      
      // Ctrl+C avec une sélection
      if (e.ctrlKey && e.key === 'c' && terminalState.selectionStart && terminalState.selectionEnd) {
        if (
          terminalState.selectionStart.row !== terminalState.selectionEnd.row ||
          terminalState.selectionStart.col !== terminalState.selectionEnd.col
        ) {
          console.log('Ctrl+C détecté avec sélection');
          e.preventDefault();
          void handleCopy();
          return;
        }
      }
      
      // Ctrl+V pour coller
      if (e.ctrlKey && e.key === 'v') {
        console.log('Ctrl+V détecté');
        e.preventDefault();
        void handlePaste();
        return;
      }
    };
    
    // Ajouter au document pour s'assurer que ça fonctionne partout
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isConnected, sessionId, terminalState.selectionStart, terminalState.selectionEnd, handleCopy, handlePaste, isOptionsModalOpen]);

  // Focus and keyboard event handling
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    // Seulement désactiver le focus pendant que la modal est ouverte ou le panel IA est ouvert
    if (isConnected) {
      if (!isOptionsModalOpen) {
        terminal.focus()
      }
    }
    
    // Toujours ajouter l'écouteur d'événements, mais le gestionnaire vérifiera isOptionsModalOpen
    terminal.addEventListener('keydown', handleKeyDown)

    return () => {
      terminal.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, isConnected, isOptionsModalOpen])

  // Click to focus - ne pas prendre le focus si le panel IA est ouvert
  const handleClick = () => {
    if (terminalRef.current && isConnected && !isOptionsModalOpen) {
      terminalRef.current.focus()
    }
  }

  // Fonction pour sélectionner un mot au double-clic
  const selectWordAt = useCallback((row: number, col: number) => {
    const currentBuffer = terminalState.isAlternateScreen && terminalState.alternateBuffer 
      ? terminalState.alternateBuffer 
      : terminalState.buffer;
    
    if (!currentBuffer[row]) return null;
    
    const line = currentBuffer[row];
    const lineText = line.map(char => char.char).join('');
    
    // Si on clique sur un espace, ne rien sélectionner
    if (/\s/.test(lineText[col])) return null;
    
    // Déterminer le type de caractère pour adapter la sélection
    const currentChar = lineText[col];
    let wordBoundaryRegex;
    
    if (/[a-zA-Z0-9_]/.test(currentChar)) {
      // Caractères alphanumériques et underscore
      wordBoundaryRegex = /[^a-zA-Z0-9_]/;
    } else if (/[\/\\\.\-]/.test(currentChar)) {
      // Chemins de fichiers et URLs
      wordBoundaryRegex = /[\s\(\)\[\]\{\}<>|&;'"`,]/;
    } else {
      // Autres caractères spéciaux
      wordBoundaryRegex = /[\s]/;
    }
    
    // Trouver le début du mot
    let startCol = col;
    while (startCol > 0 && !wordBoundaryRegex.test(lineText[startCol - 1])) {
      startCol--;
    }
    
    // Trouver la fin du mot
    let endCol = col;
    while (endCol < lineText.length - 1 && !wordBoundaryRegex.test(lineText[endCol + 1])) {
      endCol++;
    }
    
    // S'assurer qu'on a au moins un caractère sélectionné
    if (startCol <= endCol && /\S/.test(lineText[col])) {
      return { start: { row, col: startCol }, end: { row, col: endCol } };
    }
    
    return null;
  }, [terminalState.isAlternateScreen, terminalState.alternateBuffer, terminalState.buffer]);

  // Gestionnaire de la sélection de texte au début du clic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Clic gauche uniquement
      const rect = terminalRef.current?.getBoundingClientRect()
      if (!rect) return

      // Calculer la position du clic en termes de caractère
      const charWidth = 8.4 // Largeur du caractère en pixels
      const charHeight = 16 // Hauteur du caractère en pixels
      const padding = 8 // Padding du terminal

      const col = Math.max(0, Math.floor((e.clientX - rect.left - padding) / charWidth))
      const displayRow = Math.max(0, Math.floor((e.clientY - rect.top - padding) / charHeight))
      
      // Calculer la ligne réelle dans le buffer
      const currentBuffer = terminalState.isAlternateScreen && terminalState.alternateBuffer 
        ? terminalState.alternateBuffer 
        : terminalState.buffer;
      
      let actualRow;
      
      if (currentBuffer.length <= terminalState.rows) {
        // Le buffer est plus petit que la zone visible
        // Les lignes vides sont en haut, le contenu en bas
        const emptyLinesAtTop = terminalState.rows - currentBuffer.length;
        if (displayRow < emptyLinesAtTop) {
          // Clic sur une ligne vide, ignorer
          return;
        }
        actualRow = displayRow - emptyLinesAtTop;
      } else {
        // Le buffer est plus grand que la zone visible
        const visibleStartIndex = Math.max(0, currentBuffer.length - terminalState.rows - terminalState.scrollOffset);
        actualRow = visibleStartIndex + displayRow;
      }
      
      // Vérifier que la ligne existe dans le buffer
      if (actualRow < 0 || actualRow >= currentBuffer.length) {
        return;
      }

      // Debug: console.log('Clic détecté:', { displayRow, actualRow, col });

      // Vérifier si c'est un double-clic
      if (e.detail === 2) {
        // Double-clic : sélectionner le mot
        const wordSelection = selectWordAt(actualRow, col);
        if (wordSelection) {
          setTerminalState(prev => ({
            ...prev,
            selectionStart: wordSelection.start,
            selectionEnd: wordSelection.end,
            isSelecting: false,
            contextMenuPosition: null
          }));
          return;
        }
      }

      // Clic simple : initialiser la sélection
      setTerminalState(prev => ({
        ...prev,
        selectionStart: { row: actualRow, col },
        selectionEnd: { row: actualRow, col },
        isSelecting: true,
        contextMenuPosition: null // Fermer le menu contextuel s'il est ouvert
      }))
    }
  }, [terminalState.scrollOffset, terminalState.isAlternateScreen, terminalState.alternateBuffer, terminalState.buffer, terminalState.rows, selectWordAt])

  // Gestionnaire de déplacement de la souris pour la sélection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!terminalState.isSelecting) return

    const rect = terminalRef.current?.getBoundingClientRect()
    if (!rect) return

    // Calculer la position actuelle
    const charWidth = 8.4
    const charHeight = 16
    const padding = 8

    const col = Math.max(0, Math.floor((e.clientX - rect.left - padding) / charWidth))
    const displayRow = Math.max(0, Math.floor((e.clientY - rect.top - padding) / charHeight))
    
    // Calculer la ligne réelle dans le buffer (même logique que handleMouseDown)
    const currentBuffer = terminalState.isAlternateScreen && terminalState.alternateBuffer 
      ? terminalState.alternateBuffer 
      : terminalState.buffer;
    
    let actualRow;
    
    if (currentBuffer.length <= terminalState.rows) {
      // Le buffer est plus petit que la zone visible
      const emptyLinesAtTop = terminalState.rows - currentBuffer.length;
      if (displayRow < emptyLinesAtTop) {
        // Mouvement sur une ligne vide, utiliser la première ligne du buffer
        actualRow = 0;
      } else {
        actualRow = displayRow - emptyLinesAtTop;
      }
    } else {
      // Le buffer est plus grand que la zone visible
      const visibleStartIndex = Math.max(0, currentBuffer.length - terminalState.rows - terminalState.scrollOffset);
      actualRow = visibleStartIndex + displayRow;
    }
    
    // S'assurer que la ligne est dans les limites du buffer
    actualRow = Math.min(currentBuffer.length - 1, Math.max(0, actualRow));

    // S'assurer que la colonne est dans les limites
    const maxCol = currentBuffer[actualRow] ? currentBuffer[actualRow].length - 1 : 0;
    const clampedCol = Math.min(col, maxCol);

    // Mettre à jour la fin de la sélection
    setTerminalState(prev => ({
      ...prev,
      selectionEnd: { row: actualRow, col: clampedCol }
    }))
  }, [terminalState.isSelecting, terminalState.scrollOffset, terminalState.isAlternateScreen, terminalState.alternateBuffer, terminalState.buffer, terminalState.rows])

  // Gestionnaire de fin de sélection
  const handleMouseUp = useCallback(() => {
    setTerminalState(prev => {
      // Si on n'a pas bougé la souris (clic simple sans drag), effacer la sélection
      if (prev.isSelecting && prev.selectionStart && prev.selectionEnd &&
          prev.selectionStart.row === prev.selectionEnd.row &&
          prev.selectionStart.col === prev.selectionEnd.col) {
        return {
          ...prev,
          isSelecting: false,
          selectionStart: null,
          selectionEnd: null
        }
      }
      
      return {
        ...prev,
        isSelecting: false
      }
    })
  }, [])

  // Calculate terminal dimensions based on container size
  const calculateDimensions = useCallback(() => {
    if (!terminalRef.current) return { rows: 24, cols: 80 }
    
    const rect = terminalRef.current.getBoundingClientRect()
    const charWidth = 8.4 // Character width in pixels
    const charHeight = 16 // Character height in pixels
    const padding = 16 // Total padding (8px on each side)
    
    const availableWidth = rect.width - padding
    const availableHeight = rect.height - padding
    
    const cols = Math.max(20, Math.floor(availableWidth / charWidth))
    const rows = Math.max(5, Math.floor(availableHeight / charHeight))
    
    return { rows, cols }
  }, [])

  // Parse ANSI escape sequences
  const parseAnsiSequence = useCallback((sequence: string, currentStyle: TerminalStyle): TerminalStyle => {
    const newStyle = { ...currentStyle }
    
    if (sequence.startsWith('[')) {
      const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
      
      for (let i = 0; i < params.length; i++) {
        const param = params[i]
        
        switch (param) {
          case 0: // Reset
            Object.assign(newStyle, defaultStyle)
            break
          case 1: // Bold
            newStyle.bold = true
            break
          case 2: // Dim
            newStyle.dim = true
            break
          case 3: // Italic
            newStyle.italic = true
            break
          case 4: // Underline
            newStyle.underline = true
            break
          case 7: // Reverse
            newStyle.reverse = true
            break
          case 9: // Strikethrough
            newStyle.strikethrough = true
            break
          case 22: // Normal intensity
            newStyle.bold = false
            newStyle.dim = false
            break
          case 23: // Not italic
            newStyle.italic = false
            break
          case 24: // Not underlined
            newStyle.underline = false
            break
          case 27: // Not reversed
            newStyle.reverse = false
            break
          case 29: // Not strikethrough
            newStyle.strikethrough = false
            break
          case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
            // Foreground colors (30-37)
            newStyle.fg = ansiColors[param - 30] || defaultStyle.fg
            break
          case 38:
            // Extended foreground color
            if (i + 1 < params.length && params[i + 1] === 5) {
              // 256-color mode
              if (i + 2 < params.length) {
                const colorIndex = params[i + 2]
                if (colorIndex < 16) {
                  newStyle.fg = ansiColors[colorIndex] || defaultStyle.fg
                } else if (colorIndex < 232) {
                  // 216-color cube
                  const r = Math.floor((colorIndex - 16) / 36)
                  const g = Math.floor(((colorIndex - 16) % 36) / 6)
                  const b = (colorIndex - 16) % 6
                  newStyle.fg = `rgb(${r * 51}, ${g * 51}, ${b * 51})`
                } else {
                  // Grayscale
                  const gray = 8 + (colorIndex - 232) * 10
                  newStyle.fg = `rgb(${gray}, ${gray}, ${gray})`
                }
                i += 2
              }
            } else if (i + 1 < params.length && params[i + 1] === 2) {
              // RGB mode
              if (i + 4 < params.length) {
                const r = params[i + 2]
                const g = params[i + 3]
                const b = params[i + 4]
                newStyle.fg = `rgb(${r}, ${g}, ${b})`
                i += 4
              }
            }
            break
          case 39: // Default foreground
            newStyle.fg = defaultStyle.fg
            break
          case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
            // Background colors (40-47)
            newStyle.bg = ansiColors[param - 40] || defaultStyle.bg
            break
          case 48:
            // Extended background color (similar to 38 but for background)
            if (i + 1 < params.length && params[i + 1] === 5) {
              if (i + 2 < params.length) {
                const colorIndex = params[i + 2]
                if (colorIndex < 16) {
                  newStyle.bg = ansiColors[colorIndex] || defaultStyle.bg
                } else if (colorIndex < 232) {
                  const r = Math.floor((colorIndex - 16) / 36)
                  const g = Math.floor(((colorIndex - 16) % 36) / 6)
                  const b = (colorIndex - 16) % 6
                  newStyle.bg = `rgb(${r * 51}, ${g * 51}, ${b * 51})`
                } else {
                  const gray = 8 + (colorIndex - 232) * 10
                  newStyle.bg = `rgb(${gray}, ${gray}, ${gray})`
                }
                i += 2
              }
            } else if (i + 1 < params.length && params[i + 1] === 2) {
              if (i + 4 < params.length) {
                const r = params[i + 2]
                const g = params[i + 3]
                const b = params[i + 4]
                newStyle.bg = `rgb(${r}, ${g}, ${b})`
                i += 4
              }
            }
            break
          case 49: // Default background
            newStyle.bg = defaultStyle.bg
            break
          case 90: case 91: case 92: case 93: case 94: case 95: case 96: case 97:
            // Bright foreground colors (90-97)
            newStyle.fg = ansiColors[param - 90 + 8] || defaultStyle.fg
            break
          case 100: case 101: case 102: case 103: case 104: case 105: case 106: case 107:
            // Bright background colors (100-107)
            newStyle.bg = ansiColors[param - 100 + 8] || defaultStyle.bg
            break
        }
      }
    }
    
    return newStyle
  }, [])

  // Initialize terminal on mount and when dimensions change
  useEffect(() => {
    const { rows, cols } = calculateDimensions()
    const buffer = initializeBuffer(rows, cols)
    
    setTerminalState({
      buffer,
      cursorRow: 0,
      cursorCol: 0,
      rows,
      cols,
      currentStyle: defaultStyle,
      alternateBuffer: null,
      savedCursor: null,
      isAlternateScreen: false,
      lastPromptRow: 0,
      scrollTop: 0,
      scrollRegionTop: 0,
      scrollRegionBottom: rows - 1,
      isEditingCommand: false,
      lastCommandRow: 0,
      recentCursorMoves: 0,
      lastDataTime: 0,
      lineRewriteInProgress: false,
      maxLineLength: 0,
      renderKey: 0,
      selectionStart: null,
      selectionEnd: null,
      isSelecting: false,
      contextMenuPosition: null,
      isAIWriting: false,
      aiWritingCommand: null,
      aiWritingDescription: null,
      aiExplanationText: null,
      aiTypingPosition: null,
      scrollOffset: 0,
      maxBufferSize: 10000
    })
  }, [calculateDimensions, initializeBuffer])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const { rows, cols } = calculateDimensions()
      
      setTerminalState(prev => {
        // Only update if dimensions actually changed
        if (prev.rows === rows && prev.cols === cols) {
          return prev
        }

        // Resize buffer
        let newBuffer = initializeBuffer(rows, cols)
        let newAlternateBuffer = prev.alternateBuffer ? initializeBuffer(rows, cols) : null
        
        // Copy existing content if we have it
        if (prev.buffer && prev.buffer.length > 0) {
          const copyRows = Math.min(prev.buffer.length, rows)
          for (let i = 0; i < copyRows; i++) {
            const copyCols = Math.min(prev.buffer[i]?.length || 0, cols)
            for (let j = 0; j < copyCols; j++) {
              if (prev.buffer[i] && prev.buffer[i][j]) {
                newBuffer[i][j] = prev.buffer[i][j]
              }
            }
          }
        }

        // Copy alternate buffer if it exists
        if (prev.alternateBuffer && newAlternateBuffer) {
          const copyRows = Math.min(prev.alternateBuffer.length, rows)
          for (let i = 0; i < copyRows; i++) {
            const copyCols = Math.min(prev.alternateBuffer[i]?.length || 0, cols)
            for (let j = 0; j < copyCols; j++) {
              if (prev.alternateBuffer[i] && prev.alternateBuffer[i][j]) {
                newAlternateBuffer[i][j] = prev.alternateBuffer[i][j]
              }
            }
          }
        }

        // Adjust cursor position if needed
        const newCursorRow = Math.min(prev.cursorRow, rows - 1)
        const newCursorCol = Math.min(prev.cursorCol, cols - 1)

        // Notify SSH session of resize
        if (sessionId && isConnected && (window as any).electronAPI?.sshResize) {
          (window as any).electronAPI.sshResize(sessionId, cols, rows)
        }

        return {
          ...prev,
          buffer: newBuffer,
          alternateBuffer: newAlternateBuffer,
          cursorRow: newCursorRow,
          cursorCol: newCursorCol,
          rows,
          cols,
          scrollRegionBottom: rows - 1,
          renderKey: prev.renderKey + 1
        }
      })
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Initial calculation

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [calculateDimensions, initializeBuffer, sessionId, isConnected])

  // Handle SSH data with optimized throttling for better performance
  useEffect(() => {
    if (!sessionId || !isConnected) return

    let dataBuffer = '';
    let processTimeout: NodeJS.Timeout | null = null;
    let isProcessing = false;

    const processBufferedData = () => {
      if (!dataBuffer || isProcessing) return;
      
      isProcessing = true;
      const dataToProcess = dataBuffer;
      dataBuffer = '';
      
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        handleSSHDataImmediate(sessionId, dataToProcess);
        isProcessing = false;
        
        // Process any data that accumulated during processing
        if (dataBuffer) {
          processTimeout = setTimeout(processBufferedData, 8);
        }
      });
    };

    const handleSSHData = (receivedSessionId: string, data: string) => {
      if (receivedSessionId !== sessionId) return;
      
      // Buffer the data
      dataBuffer += data;
      
      // Clear existing timeout
      if (processTimeout) {
        clearTimeout(processTimeout);
      }
      
      // Process buffered data with optimized timing
      if (!isProcessing) {
        processTimeout = setTimeout(processBufferedData, 8); // Faster response
      }
    };

    const handleSSHDataImmediate = (receivedSessionId: string, data: string) => {
      if (receivedSessionId !== sessionId) return

      setTerminalState(prev => {
        let { 
          buffer, 
          cursorRow, 
          cursorCol, 
          rows, 
          cols, 
          currentStyle, 
          alternateBuffer, 
          savedCursor, 
          isAlternateScreen,
          scrollRegionTop,
          scrollRegionBottom,
          isEditingCommand,
          lastCommandRow,
          recentCursorMoves,
          lastDataTime,
          lineRewriteInProgress,
          maxLineLength
        } = prev

        // Track timing for better backspace detection
        const currentTime = Date.now()
        const timeDelta = currentTime - lastDataTime
        
        // Debug: Log incoming data for development
        if (process.env.NODE_ENV === 'development' && data.length < 50 && data.includes('\x1b')) {
          const readableData = data
            .replace(/\x1b/g, '<ESC>')
            .replace(/\r/g, '<CR>')
            .replace(/\n/g, '<LF>')
            .replace(/\b/g, '<BS>')
            .replace(/\t/g, '<TAB>')
          
          console.log('Terminal data:', {
            raw: data,
            readable: readableData,
            bytes: Array.from(data).map(c => c.charCodeAt(0)),
            cursorPos: `(${cursorRow},${cursorCol})`,
            isEditing: isEditingCommand,
            lineRewrite: lineRewriteInProgress
          })
        }
        
        // Ensure buffer is properly initialized
        if (!buffer || buffer.length === 0) {
          buffer = initializeBuffer(rows, cols)
          cursorRow = 0
          cursorCol = 0
        }

        // Create a copy of the current buffer (main or alternate)
        const currentBuffer = isAlternateScreen && alternateBuffer ? alternateBuffer : buffer
        // Shallow copy for better performance - only copy what we modify
        const newBuffer = currentBuffer.map(row => [...row])
        let newCurrentStyle = { ...currentStyle }
        let newAlternateBuffer = alternateBuffer
        let newSavedCursor = savedCursor
        let newIsAlternateScreen = isAlternateScreen
        let newScrollRegionTop = scrollRegionTop
        let newScrollRegionBottom = scrollRegionBottom
        let newIsEditingCommand = isEditingCommand
        let newLastCommandRow = lastCommandRow
        let newRecentCursorMoves = recentCursorMoves
        let newLastDataTime = currentTime
        let newLineRewriteInProgress = lineRewriteInProgress
        let newMaxLineLength = maxLineLength

        // Decay cursor move counter over time
        if (timeDelta > 100) {
          newRecentCursorMoves = Math.max(0, newRecentCursorMoves - 1)
        }

        for (let i = 0; i < data.length; i++) {
          const char = data[i]
          const charCode = data.charCodeAt(i)

          if (char === '\n') {
            // Line feed - move to next line
            cursorRow++
            
            // Reset line editing state on newline
            newLineRewriteInProgress = false
            newMaxLineLength = 0
            
            // Ensure buffer has enough lines for the new cursor position
            while (newBuffer.length <= cursorRow) {
              const newLine = Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
              newBuffer.push(newLine)
            }
            
            // When we get a newline, we're likely no longer editing a command
            // Check based on actual buffer position, not screen position
            const actualBufferPos = newBuffer.length - rows
            if (cursorRow < actualBufferPos + rows - 2) {
              newIsEditingCommand = false
            }
          } else if (char === '\r') {
            // Carriage return - move to beginning of current line
            cursorCol = 0
            
            // If we're editing a command, this often starts a line rewrite sequence
            if (isEditingCommand) {
              newLineRewriteInProgress = true
              // Track the maximum length this line has reached
              if (newBuffer[cursorRow]) {
                let lineLength = 0
                for (let col = cols - 1; col >= 0; col--) {
                  if (newBuffer[cursorRow][col] && newBuffer[cursorRow][col].char.trim() !== '') {
                    lineLength = col + 1
                    break
                  }
                }
                newMaxLineLength = Math.max(newMaxLineLength, lineLength)
              }
              newRecentCursorMoves = Math.max(newRecentCursorMoves, 5)
            }
          } else if (char === '\b') {
            // Backspace - handle cursor movement only
            // Let the shell handle the actual character deletion and redrawing
            if (cursorCol > 0) {
              cursorCol--
              
              // Track that we might be in a line edit sequence
              const isCommandEdit = isEditingCommand
              if (isCommandEdit) {
                newLineRewriteInProgress = true
                newRecentCursorMoves++
                
                // Track maximum line length for proper clearing later
                if (newBuffer[cursorRow]) {
                  let lineLength = 0
                  for (let col = cols - 1; col >= 0; col--) {
                    if (newBuffer[cursorRow][col] && newBuffer[cursorRow][col].char.trim() !== '') {
                      lineLength = col + 1
                      break
                    }
                  }
                  newMaxLineLength = Math.max(newMaxLineLength, lineLength)
                }
              }
            }
          } else if (char === '\t') {
            // Tab (move to next tab stop, typically every 8 characters)
            const nextTabStop = Math.floor(cursorCol / 8) * 8 + 8
            cursorCol = Math.min(nextTabStop, cols - 1)
          } else if (charCode >= 32 && charCode <= 126) {
            // Printable character
            
            // Ensure buffer has enough lines for current cursor position
            while (newBuffer.length <= cursorRow) {
              const newLine = Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
              newBuffer.push(newLine)
            }
            
            if (cursorCol < cols && newBuffer[cursorRow] && newBuffer[cursorRow][cursorCol]) {
              // Create new character object to ensure React detects the change
              newBuffer[cursorRow][cursorCol] = { char, style: { ...newCurrentStyle } }
              cursorCol++
              
              // If we're writing characters after a line rewrite was in progress,
              // and we've reached a reasonable position, assume the rewrite is complete
              if (newLineRewriteInProgress && cursorCol > 10) {
                // Check if we're likely past the command area - if so, stop the rewrite tracking
                const isCommandEdit = isEditingCommand
                if (isCommandEdit) {
                  const lineText = newBuffer[cursorRow].slice(0, cursorCol).map(c => c.char).join('')
                  // If we see a command after the prompt, the rewrite is probably done
                  if (/[\$#>]\s*\w+/.test(lineText)) {
                    newLineRewriteInProgress = false
                    newMaxLineLength = 0
                  }
                }
              }
              
              // Wrap to next line if at end
              if (cursorCol >= cols) {
                cursorCol = 0
                cursorRow++
                
                // Ensure buffer has enough lines for the new cursor position
                while (newBuffer.length <= cursorRow) {
                  const newLine = Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
                  newBuffer.push(newLine)
                }
              }
            }
          } else if (charCode === 27) {
            // ANSI escape sequence
            let j = i + 1
            if (j < data.length) {
              const nextChar = data[j]
              
              if (nextChar === '[') {
                // CSI (Control Sequence Introducer) sequences
                j++
                let sequence = '['
                while (j < data.length && /[0-9;?]/.test(data[j])) {
                  sequence += data[j]
                  j++
                }
                if (j < data.length) {
                  const finalChar = data[j]
                  sequence += finalChar
                  j++
                  
                  // Handle cursor movement and other control sequences
                  if (finalChar === 'H' || finalChar === 'f') {
                    // Cursor position
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 1)
                    cursorRow = Math.min(Math.max(0, (params[0] || 1) - 1), rows - 1)
                    cursorCol = Math.min(Math.max(0, (params[1] || 1) - 1), cols - 1)
                  } else if (finalChar === 'A') {
                    // Cursor up
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 1)
                    const moveCount = params[0] || 1
                    cursorRow = Math.max(newScrollRegionTop, cursorRow - moveCount)
                    newRecentCursorMoves++
                  } else if (finalChar === 'B') {
                    // Cursor down
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 1)
                    const moveCount = params[0] || 1
                    cursorRow = Math.min(newScrollRegionBottom, cursorRow + moveCount)
                    newRecentCursorMoves++
                  } else if (finalChar === 'C') {
                    // Cursor forward
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 1)
                    const moveCount = params[0] || 1
                    cursorCol = Math.min(cols - 1, cursorCol + moveCount)
                    newRecentCursorMoves++
                  } else if (finalChar === 'D') {
                    // Cursor backward
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 1)
                    const moveCount = params[0] || 1
                    cursorCol = Math.max(0, cursorCol - moveCount)
                    newRecentCursorMoves++
                  } else if (finalChar === 'G') {
                    // Cursor horizontal absolute
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 1)
                    cursorCol = Math.min(Math.max(0, (params[0] || 1) - 1), cols - 1)
                  } else if (finalChar === 'P') {
                    // Delete characters (DCH) - shifts remaining characters left
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 1)
                    const deleteCount = params[0] || 1
                    
                    // Shift characters to the left
                    for (let col = cursorCol; col < cols - deleteCount; col++) {
                      if (newBuffer[cursorRow] && newBuffer[cursorRow][col + deleteCount]) {
                        newBuffer[cursorRow][col] = { ...newBuffer[cursorRow][col + deleteCount] }
                      } else {
                        newBuffer[cursorRow][col] = { char: ' ', style: { ...defaultStyle } }
                      }
                    }
                    
                    // Clear the end of the line
                    for (let col = cols - deleteCount; col < cols; col++) {
                      if (newBuffer[cursorRow] && newBuffer[cursorRow][col]) {
                        newBuffer[cursorRow][col] = { char: ' ', style: { ...defaultStyle } }
                      }
                    }
                    
                    // Mark that we're in a line edit
                    newLineRewriteInProgress = true
                  } else if (finalChar === 'r') {
                    // Set scroll region
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
                    if (params.length >= 2) {
                      newScrollRegionTop = Math.max(0, (params[0] || 1) - 1)
                      newScrollRegionBottom = Math.min(rows - 1, (params[1] || rows) - 1)
                    } else {
                      newScrollRegionTop = 0
                      newScrollRegionBottom = rows - 1
                    }
                    // Move cursor to top-left of scroll region
                    cursorRow = newScrollRegionTop
                    cursorCol = 0
                  } else if (finalChar === 'J') {
                    // Erase display
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
                    const mode = params[0] || 0
                    if (mode === 0) {
                      // Clear from cursor to end of screen
                      for (let row = cursorRow; row < rows; row++) {
                        const startCol = row === cursorRow ? cursorCol : 0
                        for (let col = startCol; col < cols; col++) {
                          if (newBuffer[row] && newBuffer[row][col]) {
                            newBuffer[row][col] = { char: ' ', style: { ...defaultStyle } }
                          }
                        }
                      }
                    } else if (mode === 1) {
                      // Clear from beginning of screen to cursor
                      for (let row = 0; row <= cursorRow; row++) {
                        const endCol = row === cursorRow ? cursorCol : cols - 1
                        for (let col = 0; col <= endCol; col++) {
                          if (newBuffer[row] && newBuffer[row][col]) {
                            newBuffer[row][col] = { char: ' ', style: { ...defaultStyle } }
                          }
                        }
                      }
                    } else if (mode === 2) {
                      // Clear entire screen - create a fresh buffer
                      // This is what happens with the 'clear' command
                      
                      // Create a new clean buffer with just the visible rows
                      const cleanBuffer = Array(rows).fill(null).map(() => 
                        Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
                      )
                      
                      // Replace the current buffer with the clean one
                      for (let row = 0; row < cleanBuffer.length; row++) {
                        newBuffer[row] = cleanBuffer[row]
                      }
                      
                      // Remove any extra rows beyond the visible area
                      newBuffer.splice(rows)
                      
                      // Position cursor at the top-left
                      cursorRow = 0
                      cursorCol = 0
                      
                      // Reset scroll offset to ensure we're at the bottom
                      // This will be handled in the return statement
                    }
                  } else if (finalChar === 'K') {
                    // Erase line
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
                    const mode = params[0] || 0
                    
                    const isCommandEdit = isEditingCommand
                    
                      if (mode === 0) {
                        // Clear from cursor to end of line
                      // This is critically important for command line editing
                      
                      // During command editing, clear to the end of the visible line
                      const clearEnd = cols - 1
                      
                      for (let col = cursorCol; col <= clearEnd; col++) {
                          if (newBuffer[cursorRow] && newBuffer[cursorRow][col]) {
                            newBuffer[cursorRow][col] = { char: ' ', style: { ...defaultStyle } }
                          }
                        }
                      
                      // Reset line rewrite tracking after a clear
                      if (newLineRewriteInProgress && cursorCol < 10) {
                        newLineRewriteInProgress = false
                        newMaxLineLength = cursorCol
                      }
                      } else if (mode === 1) {
                        // Clear from beginning of line to cursor
                      // During command editing, only allow this if we're not at the prompt position
                      if (!isCommandEdit) {
                        for (let col = 0; col <= cursorCol; col++) {
                          if (newBuffer[cursorRow] && newBuffer[cursorRow][col]) {
                            newBuffer[cursorRow][col] = { char: ' ', style: { ...defaultStyle } }
                          }
                          }
                        }
                      } else if (mode === 2) {
                        // Clear entire line
                      // During command editing, only allow this if cursor is at beginning
                      if (!isCommandEdit || cursorCol === 0) {
                        for (let col = 0; col < cols; col++) {
                          if (newBuffer[cursorRow] && newBuffer[cursorRow][col]) {
                            newBuffer[cursorRow][col] = { char: ' ', style: { ...defaultStyle } }
                          }
                        }
                      }
                    }
                  } else if (finalChar === 'm') {
                    // Color/style sequence
                    newCurrentStyle = parseAnsiSequence(sequence, newCurrentStyle)
                  } else if (finalChar === '~') {
                    // Tilde sequences for special keys (Delete, Insert, etc.)
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
                    const keyCode = params[0] || 0
                    
                    if (keyCode === 3) {
                      // Delete key - just track that we're in an edit sequence
                      const isCommandEdit = isEditingCommand
                      
                      if (isCommandEdit) {
                        // Track that we're in a potential line edit
                        newLineRewriteInProgress = true
                        newMaxLineLength = Math.max(newMaxLineLength, cursorCol + 20)
                      }
                    }
                    // Other tilde sequences can be added here (Insert, PageUp, PageDown, etc.)
                  } else if (finalChar === 'h' || finalChar === 'l') {
                    // Set/Reset mode
                    const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
                    const isSet = finalChar === 'h'
                    
                    for (const param of params) {
                      if (param === 1049) {
                        // Alternate screen buffer with cursor save/restore
                        if (isSet) {
                          // Save cursor and switch to alternate screen
                          newSavedCursor = {
                            row: cursorRow,
                            col: cursorCol,
                            style: { ...newCurrentStyle }
                          }
                          newAlternateBuffer = initializeBuffer(rows, cols)
                          newIsAlternateScreen = true
                          cursorRow = 0
                          cursorCol = 0
                          newScrollRegionTop = 0
                          newScrollRegionBottom = rows - 1
                        } else {
                          // Restore cursor and switch back to main screen
                          newIsAlternateScreen = false
                          if (newSavedCursor) {
                            cursorRow = newSavedCursor.row
                            cursorCol = newSavedCursor.col
                            newCurrentStyle = { ...newSavedCursor.style }
                          }
                          newAlternateBuffer = null
                        }
                      } else if (param === 47) {
                        // Alternate screen buffer (without cursor save/restore)
                        if (isSet) {
                          newAlternateBuffer = initializeBuffer(rows, cols)
                          newIsAlternateScreen = true
                          cursorRow = 0
                          cursorCol = 0
                          newScrollRegionTop = 0
                          newScrollRegionBottom = rows - 1
                        } else {
                          newIsAlternateScreen = false
                          newAlternateBuffer = null
                        }
                      } else if (param === 25) {
                        // Cursor visibility (ignore for now)
                      } else if (param === 2004) {
                        // Bracketed paste mode (ignore)
                      }
                    }
                  }
                }
              } else if (nextChar === ']') {
                // OSC (Operating System Command) sequences - like window title
                j++
                let sequence = ']'
                while (j < data.length && data[j] !== '\x07' && data[j] !== '\x1b') {
                  sequence += data[j]
                  j++
                }
                if (j < data.length) {
                  if (data[j] === '\x07') {
                    // BEL terminator
                    j++
                  } else if (data[j] === '\x1b' && j + 1 < data.length && data[j + 1] === '\\') {
                    // ESC \ terminator
                    j += 2
                  }
                }
                // OSC sequences are typically for setting window title, etc.
                // We ignore them for terminal display
              } else if (nextChar === '(' || nextChar === ')') {
                // Character set selection - ignore
                j++
                if (j < data.length) {
                  j++ // Skip the character set identifier
                }
              } else if (nextChar === '7') {
                // Save cursor position and attributes (DECSC)
                j++
                newSavedCursor = {
                  row: cursorRow,
                  col: cursorCol,
                  style: { ...newCurrentStyle }
                }
              } else if (nextChar === '8') {
                // Restore cursor position and attributes (DECRC)
                j++
                if (newSavedCursor) {
                  cursorRow = newSavedCursor.row
                  cursorCol = newSavedCursor.col
                  newCurrentStyle = { ...newSavedCursor.style }
                }
              } else if (nextChar === '=') {
                // Application keypad mode - ignore
                j++
              } else if (nextChar === '>') {
                // Normal keypad mode - ignore
                j++
              } else if (nextChar === 'D') {
                // Index (move cursor down one line, scroll if at bottom)
                j++
                cursorRow++
                if (cursorRow > newScrollRegionBottom) {
                  // Scroll within the scroll region
                  for (let row = newScrollRegionTop; row < newScrollRegionBottom; row++) {
                    for (let col = 0; col < cols; col++) {
                      if (newBuffer[row] && newBuffer[row + 1] && newBuffer[row + 1][col]) {
                        newBuffer[row][col] = { ...newBuffer[row + 1][col] }
                      }
                    }
                  }
                  // Clear the bottom line of scroll region
                  for (let col = 0; col < cols; col++) {
                    if (newBuffer[newScrollRegionBottom] && newBuffer[newScrollRegionBottom][col]) {
                      newBuffer[newScrollRegionBottom][col] = { char: ' ', style: { ...defaultStyle } }
                    }
                  }
                  cursorRow = newScrollRegionBottom
                }
              } else if (nextChar === 'M') {
                // Reverse index (move cursor up one line, scroll if at top)
                j++
                cursorRow--
                if (cursorRow < newScrollRegionTop) {
                  // Scroll up within the scroll region
                  for (let row = newScrollRegionBottom; row > newScrollRegionTop; row--) {
                    for (let col = 0; col < cols; col++) {
                      if (newBuffer[row] && newBuffer[row - 1] && newBuffer[row - 1][col]) {
                        newBuffer[row][col] = { ...newBuffer[row - 1][col] }
                      }
                    }
                  }
                  // Clear the top line of scroll region
                  for (let col = 0; col < cols; col++) {
                    if (newBuffer[newScrollRegionTop] && newBuffer[newScrollRegionTop][col]) {
                      newBuffer[newScrollRegionTop][col] = { char: ' ', style: { ...defaultStyle } }
                    }
                  }
                  cursorRow = newScrollRegionTop
                }
              } else if (nextChar === 'E') {
                // Next line (move to beginning of next line)
                j++
                cursorRow++
                cursorCol = 0
                if (cursorRow > newScrollRegionBottom) {
                  // Scroll within the scroll region
                  for (let row = newScrollRegionTop; row < newScrollRegionBottom; row++) {
                    for (let col = 0; col < cols; col++) {
                      if (newBuffer[row] && newBuffer[row + 1] && newBuffer[row + 1][col]) {
                        newBuffer[row][col] = { ...newBuffer[row + 1][col] }
                      }
                    }
                  }
                  // Clear the bottom line of scroll region
                  for (let col = 0; col < cols; col++) {
                    if (newBuffer[newScrollRegionBottom] && newBuffer[newScrollRegionBottom][col]) {
                      newBuffer[newScrollRegionBottom][col] = { char: ' ', style: { ...defaultStyle } }
                    }
                  }
                  cursorRow = newScrollRegionBottom
                }
              } else {
                // Unknown escape sequence, skip it
                j++
              }
              i = j - 1
            }
          }
        }

        // Update the appropriate buffer
        if (newIsAlternateScreen) {
          newAlternateBuffer = newBuffer
        } else {
          buffer = newBuffer
        }

        // Trim buffer if it exceeds maximum size (keep recent history)
        if (buffer.length > prev.maxBufferSize) {
          const trimAmount = buffer.length - prev.maxBufferSize
          buffer = buffer.slice(trimAmount)
          // Adjust cursor position after trimming
          cursorRow = Math.max(0, cursorRow - trimAmount)
        }

        // Check if this was a clear screen operation (buffer was reset to just visible rows)
        const currentBufferForCheck = newIsAlternateScreen ? newAlternateBuffer : buffer
        const wasClearScreen = currentBufferForCheck && currentBufferForCheck.length === rows && 
                              cursorRow === 0 && cursorCol === 0 && 
                              data.includes('\x1b[2J')

        return {
          ...prev,
          buffer: newIsAlternateScreen ? buffer : newBuffer,
          alternateBuffer: newAlternateBuffer,
          cursorRow,
          cursorCol,
          currentStyle: newCurrentStyle,
          savedCursor: newSavedCursor,
          isAlternateScreen: newIsAlternateScreen,
          scrollRegionTop: newScrollRegionTop,
          scrollRegionBottom: newScrollRegionBottom,
          isEditingCommand: newIsEditingCommand,
          lastCommandRow: newLastCommandRow,
          recentCursorMoves: newRecentCursorMoves,
          lastDataTime: newLastDataTime,
          lineRewriteInProgress: newLineRewriteInProgress,
          maxLineLength: newMaxLineLength,
          renderKey: prev.renderKey + 1,
          // Reset scroll offset on clear screen, otherwise auto-scroll to bottom when new data arrives
          scrollOffset: wasClearScreen ? 0 : (prev.scrollOffset === 0 ? 0 : prev.scrollOffset)
        }
      })
    }

    if ((window as any).electronAPI?.onSSHData) {
      (window as any).electronAPI.onSSHData(handleSSHData)
    }

    return () => {
      if ((window as any).electronAPI?.offSSHData) {
        (window as any).electronAPI.offSSHData()
      }
      if (processTimeout) {
        clearTimeout(processTimeout);
      }
    }
  }, [sessionId, isConnected, initializeBuffer, parseAnsiSequence])

  // Handle AI writing notifications
  useEffect(() => {
    if (!sessionId) return;

    const handleAIWriting = (event: CustomEvent) => {
      const update = event.detail;
      if (update.sessionId !== sessionId) return;

      setTerminalState(prev => ({
        ...prev,
        isAIWriting: update.type === 'ai_writing_start',
        aiWritingCommand: update.type === 'ai_writing_start' ? update.command || null : null,
        aiWritingDescription: update.type === 'ai_writing_start' ? update.description || null : null,
        aiExplanationText: update.type === 'ai_writing_start' ? update.description || null : null,
        aiTypingPosition: update.type === 'ai_writing_start' ? { row: prev.cursorRow, col: prev.cursorCol } : null
      }));
    };

    // Listen for AI writing custom events
    window.addEventListener('ai-writing', handleAIWriting as EventListener);

    return () => {
      window.removeEventListener('ai-writing', handleAIWriting as EventListener);
    };
  }, [sessionId]);

  // AI Explanation Tooltip Component
  const AIExplanationTooltip: React.FC = () => {
    if (!terminalState.aiExplanationText) return null;

    return (
      <div 
        className="ai-explanation-tooltip"
        style={{
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      >
        <div className="ai-explanation-content">
          <span className="ai-explanation-icon">🤖</span>
          <span className="ai-explanation-text">{terminalState.aiExplanationText}</span>
        </div>
      </div>
    );
  };

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
    <div 
      className={`terminal-container ${terminalState.isAIWriting ? 'ai-writing-active' : ''}`}
      ref={terminalRef}
      tabIndex={0}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      
      <div className="terminal-screen">
        {(() => {
          // Get the current buffer (main or alternate)
          const currentBuffer = terminalState.isAlternateScreen && terminalState.alternateBuffer 
            ? terminalState.alternateBuffer 
            : terminalState.buffer;
          
          // Calculate what to display based on buffer size
          let visibleBuffer;
          let actualRowMapping: number[] = [];
          
          if (currentBuffer.length <= terminalState.rows && terminalState.scrollOffset === 0) {
            // Buffer is smaller than visible area and no scroll
            // For a fresh buffer (like after clear), show content from the top
            // For a growing buffer, pad with empty lines at top
            
            const isCleanBuffer = currentBuffer.length === terminalState.rows && 
                                 terminalState.cursorRow === 0 && terminalState.cursorCol === 0;
            
            if (isCleanBuffer) {
              // Fresh buffer after clear - show as-is from top
              visibleBuffer = [...currentBuffer];
              
              // Map display rows to actual buffer rows (1:1 mapping)
              for (let i = 0; i < terminalState.rows; i++) {
                actualRowMapping[i] = i;
              }
            } else {
              // Growing buffer - pad with empty lines at top
              const emptyLinesAtTop = terminalState.rows - currentBuffer.length;
              const emptyLine = Array(terminalState.cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }));
              
              visibleBuffer = [
                ...Array(emptyLinesAtTop).fill(null).map(() => [...emptyLine]),
                ...currentBuffer
              ];
              
              // Map display rows to actual buffer rows
              for (let i = 0; i < terminalState.rows; i++) {
                if (i < emptyLinesAtTop) {
                  actualRowMapping[i] = -1; // Empty line
                } else {
                  actualRowMapping[i] = i - emptyLinesAtTop;
                }
              }
            }
          } else {
            // Buffer is larger than visible area OR we have scroll offset
            const visibleStartIndex = Math.max(0, currentBuffer.length - terminalState.rows - terminalState.scrollOffset);
            const visibleEndIndex = Math.min(currentBuffer.length, visibleStartIndex + terminalState.rows);
            
            // Get the actual buffer slice
            const bufferSlice = currentBuffer.slice(visibleStartIndex, visibleEndIndex);
            
            // Pad with empty lines if needed
            const emptyLine = Array(terminalState.cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }));
            const missingLines = terminalState.rows - bufferSlice.length;
            
            if (missingLines > 0) {
              visibleBuffer = [
                ...Array(missingLines).fill(null).map(() => [...emptyLine]),
                ...bufferSlice
              ];
            } else {
              visibleBuffer = bufferSlice;
            }
            
            // Map display rows to actual buffer rows
            for (let i = 0; i < terminalState.rows; i++) {
              if (missingLines > 0 && i < missingLines) {
                actualRowMapping[i] = -1; // Empty line
              } else {
                actualRowMapping[i] = visibleStartIndex + (i - (missingLines > 0 ? missingLines : 0));
              }
            }
          }
          
          // Calculate cursor position relative to visible area
          let visibleCursorRow = -1;
          if (terminalState.scrollOffset === 0) {
            if (currentBuffer.length <= terminalState.rows) {
              const isCleanBuffer = currentBuffer.length === terminalState.rows && 
                                   terminalState.cursorRow === 0 && terminalState.cursorCol === 0;
              
              if (isCleanBuffer) {
                // Fresh buffer after clear - cursor position is direct
                visibleCursorRow = terminalState.cursorRow;
              } else {
                // Growing buffer - account for empty lines at top
                const emptyLinesAtTop = terminalState.rows - currentBuffer.length;
                visibleCursorRow = emptyLinesAtTop + terminalState.cursorRow;
              }
            } else {
              const visibleStartIndex = Math.max(0, currentBuffer.length - terminalState.rows);
              if (terminalState.cursorRow >= visibleStartIndex) {
                visibleCursorRow = terminalState.cursorRow - visibleStartIndex;
              }
            }
          }
          
          return visibleBuffer.map((row, displayIndex) => {
            const actualBufferRow = actualRowMapping[displayIndex];
            
            return (
              <TerminalRow
                key={actualBufferRow >= 0 ? `row-${actualBufferRow}` : `empty-${displayIndex}`}
                row={row}
                rowIndex={displayIndex}
                cursorRow={visibleCursorRow}
                cursorCol={terminalState.cursorCol}
                isCellSelected={isCellSelected}
                actualBufferRow={actualBufferRow}
              />
            );
          });
        })()}
      </div>

      {/* Scroll indicator */}
      {terminalState.scrollOffset > 0 && (
        <div className="terminal-scroll-indicator">
          <span>Viewing history</span>
          <small>({terminalState.scrollOffset} lines back)</small>
        </div>
      )}

      {/* Menu contextuel */}
      {terminalState.contextMenuPosition && (
        <TerminalContextMenu 
          position={terminalState.contextMenuPosition}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* Modal des options du terminal */}
      <TerminalOptionsModal 
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
      />

      {/* AI Explanation Tooltip */}
      <AIExplanationTooltip />

    </div>
  )
}

export default Terminal 