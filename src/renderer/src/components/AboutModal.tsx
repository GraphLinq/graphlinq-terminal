import React from 'react';
import { RiCloseLine } from 'react-icons/ri';
import { FaTerminal } from 'react-icons/fa';
import { appInfo } from '../data/appInfo';
import './AboutModal.scss';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    e.stopPropagation();
  };

  const openRepository = () => {
    // Note: Functionality will be implemented when openExternal is fully configured
    console.log('Opening repository:', appInfo.repository);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="about-modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="about-modal">
        <div className="about-modal-header">
          <div className="about-modal-title">
            <FaTerminal className="about-icon" />
            <h3>About GraphLinq Terminal</h3>
          </div>
          <button
            className="about-modal-close-button"
            onClick={onClose}
            title="Close"
          >
            <RiCloseLine />
          </button>
        </div>

        <div className="about-modal-content">
          {/* Application Info Section */}
          <div className="about-section app-info">
            <div className="app-logo">
              <div className="logo-container">
                <FaTerminal className="app-logo-icon" />
                <div className="logo-gradient"></div>
              </div>
            </div>
            <div className="app-details">
              <h2>{appInfo.name}</h2>
              <div className="app-version">
                <span className="version">{appInfo.version} ({appInfo.build})</span>
              </div>
              <p className="app-description">
                {appInfo.description} Built by <strong>{appInfo.author}</strong> using modern web technologies.
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="about-section footer-links">
            <div className="links-grid">
              <button onClick={openRepository} className="footer-link">
                Source Code
              </button>
              <span className="footer-link">License: {appInfo.license}</span>
              <span className="footer-link">Build: {appInfo.buildDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal; 