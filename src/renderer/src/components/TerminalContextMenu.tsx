import React, { useRef, useEffect } from 'react';
import './Terminal.scss';

// Props du composant menu contextuel
interface TerminalContextMenuProps {
  position: { x: number; y: number };
  onCopy: () => void;
  onPaste: () => void;
  onClose: () => void;
}

const TerminalContextMenu: React.FC<TerminalContextMenuProps> = ({ 
  position, 
  onCopy, 
  onPaste, 
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Utiliser capture pour intercepter l'événement avant qu'il n'atteigne d'autres éléments
    document.addEventListener('mousedown', handleClickOutside, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [onClose]);

  // Gérer les événements de clic sur les boutons
  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Menu: Bouton Copier cliqué');
    onCopy();
  };

  const handlePasteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Menu: Bouton Coller cliqué');
    onPaste();
  };

  return (
    <>
      {/* Overlay pour empêcher les interactions avec le reste de la page */}
      <div 
        className="context-menu-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
      />
      
      {/* Menu contextuel */}
      <div 
        ref={menuRef}
        className="terminal-context-menu"
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handleCopyClick}
        >
          Copier
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={handlePasteClick}
        >
          Coller
        </button>
      </div>
    </>
  );
};

export default TerminalContextMenu; 