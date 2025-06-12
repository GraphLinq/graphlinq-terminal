export interface TerminalChar {
  char: string
  style: TerminalStyle
}

export interface TerminalStyle {
  fg: string
  bg: string
  bold: boolean
  dim: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  reverse: boolean
  blink: boolean
  hidden: boolean
}

export interface TerminalState {
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

export const defaultStyle: TerminalStyle = {
  fg: '#cccccc',
  bg: 'transparent',
  bold: false,
  dim: false,
  italic: false,
  underline: false,
  strikethrough: false,
  reverse: false,
  blink: false,
  hidden: false
}

// ANSI color mapping
export const ansiColors: { [key: number]: string } = {
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