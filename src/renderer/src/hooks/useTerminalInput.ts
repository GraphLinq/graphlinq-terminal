import { useCallback, useEffect, useMemo } from 'react'
import { TerminalState } from '../components/types/terminal'

interface UseTerminalInputProps {
  sessionId: string | null
  isConnected: boolean
  terminalState: TerminalState
  updateTerminalState: (updater: (prev: TerminalState) => TerminalState) => void
  handleScroll: (direction: 'up' | 'down', amount?: number) => void
  resetScroll: () => void
  terminalRef: React.RefObject<HTMLDivElement>
  isOptionsModalOpen: boolean
}

export const useTerminalInput = ({
  sessionId,
  isConnected,
  terminalState,
  updateTerminalState,
  handleScroll,
  resetScroll,
  terminalRef,
  isOptionsModalOpen
}: UseTerminalInputProps) => {

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
    updateTerminalState(prev => ({
      ...prev,
      contextMenuPosition: null,
      selectionStart: null,
      selectionEnd: null
    }))
  }, [getSelectedText, updateTerminalState])

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
    updateTerminalState(prev => ({
      ...prev,
      contextMenuPosition: null
    }))
  }, [isConnected, sessionId, updateTerminalState])

  // Handle keyboard input
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isConnected || !sessionId) return

    // Ignorer les événements clavier uniquement si la modal des options est ouverte
    if (isOptionsModalOpen) return
    
    // Handle scroll keys first (Page Up/Down, Shift+Arrow keys)
    if (e.key === 'PageUp') {
      e.preventDefault();
      handleScroll('up', 10);
      return;
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      handleScroll('down', 10);
      return;
    } else if (e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      handleScroll('up', 1);
      return;
    } else if (e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      handleScroll('down', 1);
      return;
    }
    
    // Reset scroll to bottom when user types (except for scroll commands)
    if (terminalState.scrollOffset > 0 && 
        !['PageUp', 'PageDown'].includes(e.key) && 
        !(e.shiftKey && ['ArrowUp', 'ArrowDown'].includes(e.key))) {
      resetScroll();
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
  }, [isConnected, sessionId, isOptionsModalOpen, terminalState.scrollOffset, handleScroll, resetScroll])

  // Gestionnaire de menu contextuel (clic droit)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    console.log('Menu contextuel ouvert à', e.clientX, e.clientY)
    
    updateTerminalState(prev => ({
      ...prev,
      contextMenuPosition: { x: e.clientX, y: e.clientY }
    }))
  }, [updateTerminalState])

  // Fermer le menu contextuel
  const handleCloseContextMenu = useCallback(() => {
    updateTerminalState(prev => ({
      ...prev,
      contextMenuPosition: null
    }))
  }, [updateTerminalState])

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

      // Vérifier si c'est un double-clic
      if (e.detail === 2) {
        // Double-clic : sélectionner le mot
        const wordSelection = selectWordAt(actualRow, col);
        if (wordSelection) {
          updateTerminalState(prev => ({
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
      updateTerminalState(prev => ({
        ...prev,
        selectionStart: { row: actualRow, col },
        selectionEnd: { row: actualRow, col },
        isSelecting: true,
        contextMenuPosition: null // Fermer le menu contextuel s'il est ouvert
      }))
    }
  }, [terminalState.scrollOffset, terminalState.isAlternateScreen, terminalState.alternateBuffer, terminalState.buffer, terminalState.rows, selectWordAt, updateTerminalState, terminalRef])

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
    updateTerminalState(prev => ({
      ...prev,
      selectionEnd: { row: actualRow, col: clampedCol }
    }))
  }, [terminalState.isSelecting, terminalState.scrollOffset, terminalState.isAlternateScreen, terminalState.alternateBuffer, terminalState.buffer, terminalState.rows, updateTerminalState, terminalRef])

  // Gestionnaire de fin de sélection
  const handleMouseUp = useCallback(() => {
    updateTerminalState(prev => {
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
  }, [updateTerminalState])

  return {
    isCellSelected,
    getSelectedText,
    handleCopy,
    handlePaste,
    handleKeyDown,
    handleContextMenu,
    handleCloseContextMenu,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    selectionBounds
  }
} 