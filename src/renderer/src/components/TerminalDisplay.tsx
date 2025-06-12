import React, { memo, useMemo } from 'react'
import { TerminalChar, TerminalStyle } from './types/terminal'

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

interface TerminalDisplayProps {
  buffer: TerminalChar[][]
  alternateBuffer: TerminalChar[][] | null
  isAlternateScreen: boolean
  cursorRow: number
  cursorCol: number
  rows: number
  cols: number
  scrollOffset: number
  isCellSelected: (row: number, col: number) => boolean
  defaultStyle: TerminalStyle
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

const TerminalDisplay: React.FC<TerminalDisplayProps> = ({
  buffer,
  alternateBuffer,
  isAlternateScreen,
  cursorRow,
  cursorCol,
  rows,
  cols,
  scrollOffset,
  isCellSelected,
  defaultStyle
}) => {
  // Calculate visible buffer and cursor position
  const { visibleBuffer, visibleCursorRow, actualRowMapping } = useMemo(() => {
    // Get the current buffer (main or alternate)
    const currentBuffer = isAlternateScreen && alternateBuffer ? alternateBuffer : buffer;
    
    // Calculate what to display based on buffer size
    let visibleBuffer;
    let actualRowMapping: number[] = [];
    
    if (currentBuffer.length <= rows && scrollOffset === 0) {
      // Buffer is smaller than visible area and no scroll
      // For a fresh buffer (like after clear), show content from the top
      // For a growing buffer, pad with empty lines at top
      
      const isCleanBuffer = currentBuffer.length === rows && 
                           cursorRow === 0 && cursorCol === 0;
      
      if (isCleanBuffer) {
        // Fresh buffer after clear - show as-is from top
        visibleBuffer = [...currentBuffer];
        
        // Map display rows to actual buffer rows (1:1 mapping)
        for (let i = 0; i < rows; i++) {
          actualRowMapping[i] = i;
        }
      } else {
        // Growing buffer - pad with empty lines at top
        const emptyLinesAtTop = rows - currentBuffer.length;
        const emptyLine = Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }));
        
        visibleBuffer = [
          ...Array(emptyLinesAtTop).fill(null).map(() => [...emptyLine]),
          ...currentBuffer
        ];
        
        // Map display rows to actual buffer rows
        for (let i = 0; i < rows; i++) {
          if (i < emptyLinesAtTop) {
            actualRowMapping[i] = -1; // Empty line
          } else {
            actualRowMapping[i] = i - emptyLinesAtTop;
          }
        }
      }
    } else {
      // Buffer is larger than visible area OR we have scroll offset
      const visibleStartIndex = Math.max(0, currentBuffer.length - rows - scrollOffset);
      const visibleEndIndex = Math.min(currentBuffer.length, visibleStartIndex + rows);
      
      // Get the actual buffer slice
      const bufferSlice = currentBuffer.slice(visibleStartIndex, visibleEndIndex);
      
      // Pad with empty lines if needed
      const emptyLine = Array(cols).fill(null).map(() => ({ char: ' ', style: { ...defaultStyle } }));
      const missingLines = rows - bufferSlice.length;
      
      if (missingLines > 0) {
        visibleBuffer = [
          ...Array(missingLines).fill(null).map(() => [...emptyLine]),
          ...bufferSlice
        ];
      } else {
        visibleBuffer = bufferSlice;
      }
      
      // Map display rows to actual buffer rows
      for (let i = 0; i < rows; i++) {
        if (missingLines > 0 && i < missingLines) {
          actualRowMapping[i] = -1; // Empty line
        } else {
          actualRowMapping[i] = visibleStartIndex + (i - (missingLines > 0 ? missingLines : 0));
        }
      }
    }
    
    // Calculate cursor position relative to visible area
    let visibleCursorRow = -1;
    if (scrollOffset === 0) {
      if (currentBuffer.length <= rows) {
        const isCleanBuffer = currentBuffer.length === rows && 
                             cursorRow === 0 && cursorCol === 0;
        
        if (isCleanBuffer) {
          // Fresh buffer after clear - cursor position is direct
          visibleCursorRow = cursorRow;
        } else {
          // Growing buffer - account for empty lines at top
          const emptyLinesAtTop = rows - currentBuffer.length;
          visibleCursorRow = emptyLinesAtTop + cursorRow;
        }
      } else {
        const visibleStartIndex = Math.max(0, currentBuffer.length - rows);
        if (cursorRow >= visibleStartIndex) {
          visibleCursorRow = cursorRow - visibleStartIndex;
        }
      }
    }
    
    return { visibleBuffer, visibleCursorRow, actualRowMapping };
  }, [buffer, alternateBuffer, isAlternateScreen, cursorRow, cursorCol, rows, cols, scrollOffset, defaultStyle]);

  return (
    <div className="terminal-screen">
      {visibleBuffer.map((row, displayIndex) => {
        const actualBufferRow = actualRowMapping[displayIndex];
        
        return (
          <TerminalRow
            key={actualBufferRow >= 0 ? `row-${actualBufferRow}` : `empty-${displayIndex}`}
            row={row}
            rowIndex={displayIndex}
            cursorRow={visibleCursorRow}
            cursorCol={cursorCol}
            isCellSelected={isCellSelected}
            actualBufferRow={actualBufferRow}
          />
        );
      })}
    </div>
  );
};

export default TerminalDisplay 