import React, { useEffect, useRef, useState, useCallback } from 'react'
import './Terminal.scss'
import TerminalContextMenu from './TerminalContextMenu'
import TerminalOptionsModal from './TerminalOptionsModal'
import TerminalDisplay from './TerminalDisplay'
import { useTerminalData } from '../hooks/useTerminalData'
import { useTerminalInput } from '../hooks/useTerminalInput'
import { defaultStyle } from './types/terminal'

interface TerminalProps {
  sessionId: string | null
  isConnected: boolean
  onDisconnect: () => void
}

const Terminal: React.FC<TerminalProps> = ({ sessionId, isConnected, onDisconnect }) => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState<boolean>(false)

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

  // Calculate initial dimensions
  const { rows, cols } = calculateDimensions()

  // Use terminal data hook
  const {
    terminalState,
    updateTerminalState,
    handleScroll,
    resetScroll,
    parseAnsiSequence,
    initializeBuffer,
    processSSHData
  } = useTerminalData({ sessionId, isConnected, rows, cols })

  // Create stable reference for processSSHData
  const processSSHDataRef = useRef(processSSHData)
  processSSHDataRef.current = processSSHData

  // Use terminal input hook
  const {
    isCellSelected,
    handleCopy,
    handlePaste,
    handleKeyDown,
    handleContextMenu,
    handleCloseContextMenu,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  } = useTerminalInput({
    sessionId,
    isConnected,
    terminalState,
    updateTerminalState,
    handleScroll,
    resetScroll,
    terminalRef,
    isOptionsModalOpen
  })

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const { rows: newRows, cols: newCols } = calculateDimensions()
      
      updateTerminalState(prev => {
        // Only update if dimensions actually changed
        if (prev.rows === newRows && prev.cols === newCols) {
          return prev
        }

        // Notify SSH session of resize
        if (sessionId && isConnected && (window as any).electronAPI?.sshResize) {
          (window as any).electronAPI.sshResize(sessionId, newCols, newRows)
        }

        return {
          ...prev,
          rows: newRows,
          cols: newCols,
          scrollRegionBottom: newRows - 1,
          renderKey: prev.renderKey + 1
        }
      })
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Initial calculation

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [calculateDimensions, sessionId, isConnected, updateTerminalState])

  // Handle mouse wheel scroll
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const direction = e.deltaY > 0 ? 'down' : 'up';
      const amount = Math.abs(e.deltaY) > 50 ? 5 : 3;
      
      handleScroll(direction, amount);
    };

    terminal.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      terminal.removeEventListener('wheel', handleWheel);
    };
  }, [handleScroll]);

  // Handle SSH data with optimized throttling for better performance
  useEffect(() => {
    if (!sessionId || !isConnected) return

    let dataBuffer = '';
    let processTimeout: NodeJS.Timeout | null = null;
    let isProcessing = false;
    let isUnmounted = false;

    const processBufferedData = () => {
      if (!dataBuffer || isProcessing || isUnmounted) return;
      
      isProcessing = true;
      const dataToProcess = dataBuffer;
      dataBuffer = '';
      
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        if (!isUnmounted) {
          processSSHDataRef.current(dataToProcess);
        }
        isProcessing = false;
        
        // Process any data that accumulated during processing
        if (dataBuffer && !isUnmounted) {
          processTimeout = setTimeout(processBufferedData, 8);
        }
      });
    };

    const handleSSHData = (receivedSessionId: string, data: string) => {
      if (receivedSessionId !== sessionId || isUnmounted) return;
      
      // Buffer the data
      dataBuffer += data;
      
      // Clear existing timeout
      if (processTimeout) {
        clearTimeout(processTimeout);
      }
      
      // Process buffered data with optimized timing
      if (!isProcessing && !isUnmounted) {
        processTimeout = setTimeout(processBufferedData, 8); // Faster response
      }
    };

    // Clean up any existing listeners first
    if ((window as any).electronAPI?.offSSHData) {
      (window as any).electronAPI.offSSHData()
    }

    // Add the new listener
    if ((window as any).electronAPI?.onSSHData) {
      (window as any).electronAPI.onSSHData(handleSSHData)
    }

    return () => {
      isUnmounted = true;
      if ((window as any).electronAPI?.offSSHData) {
        (window as any).electronAPI.offSSHData()
      }
      if (processTimeout) {
        clearTimeout(processTimeout);
      }
    }
  }, [sessionId, isConnected]) // Removed processSSHData from dependencies

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isConnected || !sessionId || isOptionsModalOpen) return;
      
      // Ctrl+C avec une sélection
      if (e.ctrlKey && e.key === 'c' && terminalState.selectionStart && terminalState.selectionEnd) {
        if (
          terminalState.selectionStart.row !== terminalState.selectionEnd.row ||
          terminalState.selectionStart.col !== terminalState.selectionEnd.col
        ) {
          e.preventDefault();
          void handleCopy();
          return;
        }
      }
      
      // Ctrl+V pour coller
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        void handlePaste();
        return;
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isConnected, sessionId, terminalState.selectionStart, terminalState.selectionEnd, handleCopy, handlePaste, isOptionsModalOpen]);

  // Focus and keyboard event handling
  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) return

    if (isConnected && !isOptionsModalOpen) {
      terminal.focus()
    }
    
    terminal.addEventListener('keydown', handleKeyDown)

    return () => {
      terminal.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, isConnected, isOptionsModalOpen])

  // Click to focus
  const handleClick = () => {
    if (terminalRef.current && isConnected && !isOptionsModalOpen) {
      terminalRef.current.focus()
    }
  }

  // Close context menu on outside click
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
      <TerminalDisplay
        buffer={terminalState.buffer}
        alternateBuffer={terminalState.alternateBuffer}
        isAlternateScreen={terminalState.isAlternateScreen}
        cursorRow={terminalState.cursorRow}
        cursorCol={terminalState.cursorCol}
        rows={terminalState.rows}
        cols={terminalState.cols}
        scrollOffset={terminalState.scrollOffset}
        isCellSelected={isCellSelected}
        defaultStyle={defaultStyle}
      />

      {/* Scroll indicator */}
      {terminalState.scrollOffset > 0 && (
        <div className="terminal-scroll-indicator">
          <span>Viewing history</span>
          <small>({terminalState.scrollOffset} lines back)</small>
        </div>
      )}

      {/* Context menu */}
      {terminalState.contextMenuPosition && (
        <TerminalContextMenu 
          position={terminalState.contextMenuPosition}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onClose={handleCloseContextMenu}
        />
      )}

      {/* Terminal options modal */}
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