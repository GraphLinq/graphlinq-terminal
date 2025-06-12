import { useState, useCallback, useEffect } from 'react'
import { TerminalState, TerminalChar, TerminalStyle, defaultStyle, ansiColors } from '../components/types/terminal'

interface UseTerminalDataProps {
  sessionId: string | null
  isConnected: boolean
  rows: number
  cols: number
}

export const useTerminalData = ({ sessionId, isConnected, rows, cols }: UseTerminalDataProps) => {
  // Initialize terminal buffer with proper dimensions
  const initializeBuffer = useCallback((rows: number, cols: number) => {
    // Start with just the visible rows, buffer will grow as needed
    const buffer = Array(rows).fill(null).map(() => 
      Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
    )
    return buffer
  }, [])

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

  // Parse ANSI escape sequences
  const parseAnsiSequence = useCallback((sequence: string, currentStyle: TerminalStyle): TerminalStyle => {
    const newStyle = { ...currentStyle }
    
    if (sequence.startsWith('[')) {
      // Extract parameter part (remove [ and final character)
      const paramPart = sequence.slice(1, -1)
      
      // Handle empty sequence as reset
      if (paramPart === '') {
        Object.assign(newStyle, defaultStyle)
        return newStyle
      }
      
      // Split parameters on semicolon and filter out empty strings
      const params = paramPart.split(';').map(p => {
        const num = parseInt(p.trim())
        return isNaN(num) ? 0 : num
      })
      
      for (let i = 0; i < params.length; i++) {
        const param = params[i]
        
        switch (param) {
          case 0: // Reset all attributes
            Object.assign(newStyle, defaultStyle)
            break
          case 1: // Bold/bright
            newStyle.bold = true
            break
          case 2: // Dim/faint
            newStyle.dim = true
            break
          case 3: // Italic
            newStyle.italic = true
            break
          case 4: // Underline
            newStyle.underline = true
            break
          case 5: // Slow blink
          case 6: // Rapid blink
            newStyle.blink = true
            break
          case 7: // Reverse/invert
            newStyle.reverse = true
            break
          case 8: // Conceal/hide
            newStyle.hidden = true
            break
          case 9: // Strikethrough/crossed-out
            newStyle.strikethrough = true
            break
          case 21: // Double underline
          case 22: // Normal intensity (not bold, not dim)
            newStyle.bold = false
            newStyle.dim = false
            break
          case 23: // Not italic, not Fraktur
            newStyle.italic = false
            break
          case 24: // Not underlined
            newStyle.underline = false
            break
          case 25: // Not blinking
            newStyle.blink = false
            break
          case 27: // Not reversed
            newStyle.reverse = false
            break
          case 28: // Not concealed
            newStyle.hidden = false
            break
          case 29: // Not crossed out
            newStyle.strikethrough = false
            break
          case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
            // Standard foreground colors (30-37)
            newStyle.fg = ansiColors[param - 30] || defaultStyle.fg
            break
          case 38:
            // Extended foreground color
            if (i + 1 < params.length && params[i + 1] === 5) {
              // 256-color mode: ESC[38;5;n
              if (i + 2 < params.length) {
                const colorIndex = params[i + 2]
                if (colorIndex < 16) {
                  // Standard colors
                  newStyle.fg = ansiColors[colorIndex] || defaultStyle.fg
                } else if (colorIndex < 232) {
                  // 216-color cube (6x6x6)
                  const colorBase = colorIndex - 16
                  const r = Math.floor(colorBase / 36)
                  const g = Math.floor((colorBase % 36) / 6)
                  const b = colorBase % 6
                  newStyle.fg = `rgb(${r * 51}, ${g * 51}, ${b * 51})`
                } else {
                  // Grayscale ramp (24 colors)
                  const gray = 8 + (colorIndex - 232) * 10
                  newStyle.fg = `rgb(${gray}, ${gray}, ${gray})`
                }
                i += 2 // Skip the next two parameters
              }
            } else if (i + 1 < params.length && params[i + 1] === 2) {
              // RGB mode: ESC[38;2;r;g;b
              if (i + 4 < params.length) {
                const r = Math.max(0, Math.min(255, params[i + 2]))
                const g = Math.max(0, Math.min(255, params[i + 3]))
                const b = Math.max(0, Math.min(255, params[i + 4]))
                newStyle.fg = `rgb(${r}, ${g}, ${b})`
                i += 4 // Skip the next four parameters
              }
            }
            break
          case 39: // Default foreground color
            newStyle.fg = defaultStyle.fg
            break
          case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
            // Standard background colors (40-47)
            newStyle.bg = ansiColors[param - 40] || defaultStyle.bg
            break
          case 48:
            // Extended background color
            if (i + 1 < params.length && params[i + 1] === 5) {
              // 256-color mode: ESC[48;5;n
              if (i + 2 < params.length) {
                const colorIndex = params[i + 2]
                if (colorIndex < 16) {
                  // Standard colors
                  newStyle.bg = ansiColors[colorIndex] || defaultStyle.bg
                } else if (colorIndex < 232) {
                  // 216-color cube
                  const colorBase = colorIndex - 16
                  const r = Math.floor(colorBase / 36)
                  const g = Math.floor((colorBase % 36) / 6)
                  const b = colorBase % 6
                  newStyle.bg = `rgb(${r * 51}, ${g * 51}, ${b * 51})`
                } else {
                  // Grayscale ramp
                  const gray = 8 + (colorIndex - 232) * 10
                  newStyle.bg = `rgb(${gray}, ${gray}, ${gray})`
                }
                i += 2
              }
            } else if (i + 1 < params.length && params[i + 1] === 2) {
              // RGB mode: ESC[48;2;r;g;b
              if (i + 4 < params.length) {
                const r = Math.max(0, Math.min(255, params[i + 2]))
                const g = Math.max(0, Math.min(255, params[i + 3]))
                const b = Math.max(0, Math.min(255, params[i + 4]))
                newStyle.bg = `rgb(${r}, ${g}, ${b})`
                i += 4
              }
            }
            break
          case 49: // Default background color
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
          default:
            // Unknown parameter, ignore
            break
        }
      }
    }
    
    return newStyle
  }, [])

  // Initialize terminal on mount and when dimensions change
  useEffect(() => {
    const buffer = initializeBuffer(rows, cols)
    
    setTerminalState(prev => ({
      ...prev,
      buffer,
      rows,
      cols,
      scrollRegionBottom: rows - 1,
      renderKey: prev.renderKey + 1
    }))
  }, [initializeBuffer, rows, cols])

  // Handle scroll
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

  // Process SSH data
  const processSSHData = useCallback((data: string) => {
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
            
            if (nextChar === ']') {
              // OSC (Operating System Command) sequences - like window title  
              j++
              // Find the end of the OSC sequence (terminated by \x07 or \x1b\\)
              while (j < data.length) {
                if (data[j] === '\x07') {
                  // Bell terminator
                  j++
                  break
                } else if (data[j] === '\x1b' && j + 1 < data.length && data[j + 1] === '\\') {
                  // String terminator
                  j += 2
                  break
                }
                j++
              }
              i = j - 1
            } else if (nextChar === '[') {
              // CSI (Control Sequence Introducer) sequences
              j++
              let sequence = '['
              
              // Handle private mode characters (like ?)
              if (j < data.length && data[j] === '?') {
                sequence += data[j]
                j++
              }
              
              // Collect numeric parameters and separators
              while (j < data.length && /[0-9;:]/.test(data[j])) {
                sequence += data[j]
                j++
              }
              
              // Get the final character
              if (j < data.length) {
                const finalChar = data[j]
                sequence += finalChar
                
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
                  }
                } else if (finalChar === 'K') {
                  // Erase line
                  const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
                  const mode = params[0] || 0
                  
                  if (mode === 0) {
                    // Clear from cursor to end of line
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
                    for (let col = 0; col <= cursorCol; col++) {
                      if (newBuffer[cursorRow] && newBuffer[cursorRow][col]) {
                        newBuffer[cursorRow][col] = { char: ' ', style: { ...defaultStyle } }
                      }
                    }
                  } else if (mode === 2) {
                    // Clear entire line
                    for (let col = 0; col < cols; col++) {
                      if (newBuffer[cursorRow] && newBuffer[cursorRow][col]) {
                        newBuffer[cursorRow][col] = { char: ' ', style: { ...defaultStyle } }
                      }
                    }
                  }
                } else if (finalChar === 'm') {
                  // Color/style sequence
                  newCurrentStyle = parseAnsiSequence(sequence, newCurrentStyle)
                } else if (finalChar === 'r') {
                  // Set scrolling region
                  const params = sequence.slice(1, -1).split(';').map(p => parseInt(p) || 0)
                  if (params.length >= 2) {
                    newScrollRegionTop = Math.max(0, (params[0] || 1) - 1)
                    newScrollRegionBottom = Math.min(rows - 1, (params[1] || rows) - 1)
                  }
                } else if (finalChar === 'h' || finalChar === 'l') {
                  // Set/reset mode - handle alternate screen buffer
                  const params = sequence.slice(1, -1)
                  if (params === '?1049' || params === '?47') {
                    if (finalChar === 'h') {
                      // Enter alternate screen
                      newIsAlternateScreen = true
                      if (!newAlternateBuffer) {
                        newAlternateBuffer = Array(rows).fill(null).map(() => 
                          Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }))
                        )
                      }
                      cursorRow = 0
                      cursorCol = 0
                    } else {
                      // Exit alternate screen
                      newIsAlternateScreen = false
                    }
                  }
                }
                
                // Move the index to after the complete sequence
                i = j
              } else {
                // Incomplete sequence, skip the ESC
                i = j - 1
              }
            } else if (nextChar === 'D') {
              // IND - Index (move cursor down and scroll if necessary)
              cursorRow++
              if (cursorRow > newScrollRegionBottom) {
                cursorRow = newScrollRegionBottom
                // Scroll up
                for (let row = newScrollRegionTop; row < newScrollRegionBottom; row++) {
                  newBuffer[row] = [...newBuffer[row + 1]]
                }
                // Clear the bottom line
                for (let col = 0; col < cols; col++) {
                  newBuffer[newScrollRegionBottom][col] = { char: ' ', style: { ...defaultStyle } }
                }
              }
              i = j
            } else if (nextChar === 'M') {
              // RI - Reverse Index (move cursor up and scroll if necessary)
              cursorRow--
              if (cursorRow < newScrollRegionTop) {
                cursorRow = newScrollRegionTop
                // Scroll down
                for (let row = newScrollRegionBottom; row > newScrollRegionTop; row--) {
                  newBuffer[row] = [...newBuffer[row - 1]]
                }
                // Clear the top line
                for (let col = 0; col < cols; col++) {
                  newBuffer[newScrollRegionTop][col] = { char: ' ', style: { ...defaultStyle } }
                }
              }
              i = j
            } else if (nextChar === 'E') {
              // NEL - Next Line
              cursorRow++
              cursorCol = 0
              if (cursorRow >= rows) {
                cursorRow = rows - 1
              }
              i = j
            } else if (nextChar === '7') {
              // DECSC - Save cursor
              newSavedCursor = { row: cursorRow, col: cursorCol, style: { ...newCurrentStyle } }
              i = j
            } else if (nextChar === '8') {
              // DECRC - Restore cursor
              if (newSavedCursor) {
                cursorRow = newSavedCursor.row
                cursorCol = newSavedCursor.col
                newCurrentStyle = { ...newSavedCursor.style }
              }
              i = j
            } else {
              // Unknown escape sequence, skip the ESC
              i = j - 1
            }
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

      // Check if this was a clear screen operation
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
  }, [initializeBuffer, parseAnsiSequence])

  // Update state
  const updateTerminalState = useCallback((updater: (prev: TerminalState) => TerminalState) => {
    setTerminalState(updater)
  }, [])

  // Reset scroll to bottom
  const resetScroll = useCallback(() => {
    setTerminalState(prev => ({
      ...prev,
      scrollOffset: 0
    }))
  }, [])

  return {
    terminalState,
    updateTerminalState,
    handleScroll,
    resetScroll,
    parseAnsiSequence,
    initializeBuffer,
    processSSHData
  }
} 