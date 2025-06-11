import React, { useState, useRef } from 'react';
import { RiCloseLine, RiDownloadLine, RiKey2Line, RiFolderOpenLine, RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import { FaKey, FaCopy, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import './SSHKeyGeneratorModal.scss';

interface SSHKeyGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface KeyGenerationResult {
  success: boolean;
  privateKey?: string;
  publicKey?: string;
  fingerprint?: string;
  error?: string;
  privateKeyPath?: string;
  publicKeyPath?: string;
}

const SSHKeyGeneratorModal: React.FC<SSHKeyGeneratorModalProps> = ({ isOpen, onClose }) => {
  const [keyType, setKeyType] = useState<'rsa' | 'ed25519'>('ed25519');
  const [keySize, setKeySize] = useState<number>(2048);
  const [passphrase, setPassphrase] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [saveLocation, setSaveLocation] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedKeys, setGeneratedKeys] = useState<KeyGenerationResult | null>(null);
  const [showPassphrase, setShowPassphrase] = useState<boolean>(false);
  const [showPrivateKey, setShowPrivateKey] = useState<boolean>(false);
  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});

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

  const selectSaveLocation = async () => {
    if (window.electronAPI && 'selectDirectory' in window.electronAPI) {
      try {
        const result = await (window.electronAPI as any).selectDirectory();
        if (result && !result.canceled && result.path) {
          setSaveLocation(result.path);
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
      }
    } else {
      // Fallback for development
      const defaultPath = 'C:\\Users\\%USERNAME%\\.ssh';
      setSaveLocation(defaultPath);
    }
  };

  const generateSSHKey = async () => {
    if (!saveLocation) {
      alert('Veuillez sélectionner un dossier de sauvegarde');
      return;
    }

    setIsGenerating(true);
    setGeneratedKeys(null);

    try {
      const config = {
        type: keyType,
        bits: keyType === 'rsa' ? keySize : undefined,
        passphrase: passphrase || undefined,
        comment: comment || `${keyType}-key-${Date.now()}`,
        filename: `id_${keyType}`,
        location: saveLocation
      };

      if (window.electronAPI && 'generateSSHKey' in window.electronAPI) {
        const result = await (window.electronAPI as any).generateSSHKey(config);
        setGeneratedKeys(result);
      } else {
        // Fallback simulation for development
        setTimeout(() => {
          const mockResult: KeyGenerationResult = {
            success: true,
            privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtz
c2gtZWQyNTUxOQAAACBK...
-----END OPENSSH PRIVATE KEY-----`,
            publicKey: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIEq... ${config.comment}`,
            fingerprint: 'SHA256:abc123def456...'
          };
          setGeneratedKeys(mockResult);
          setIsGenerating(false);
        }, 2000);
        return;
      }
    } catch (error: any) {
      console.error('SSH key generation error:', error);
      setGeneratedKeys({
        success: false,
        error: error.message || 'Unknown error occurred'
      });
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      if (window.electronAPI?.clipboardWriteText) {
        await window.electronAPI.clipboardWriteText(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
      
      setCopiedStates({ ...copiedStates, [key]: true });
      setTimeout(() => {
        setCopiedStates({ ...copiedStates, [key]: false });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadKey = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setGeneratedKeys(null);
    setPassphrase('');
    setComment('');
    setCopiedStates({});
  };

  if (!isOpen) return null;

  return (
    <div 
      className="ssh-keygen-modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="ssh-keygen-modal">
        <div className="ssh-keygen-modal-header">
          <div className="ssh-keygen-modal-title">
            <FaKey className="ssh-keygen-icon" />
            <h3>Générateur de clés SSH</h3>
          </div>
          <button
            className="ssh-keygen-modal-close-button"
            onClick={onClose}
            title="Fermer"
          >
            <RiCloseLine />
          </button>
        </div>

        <div className="ssh-keygen-modal-content">
          {!generatedKeys ? (
            // Configuration Form
            <div className="ssh-keygen-form">
              <div className="form-section">
                <h4>Configuration de la clé</h4>
                
                <div className="form-group">
                  <label>Type de clé</label>
                  <select 
                    value={keyType} 
                    onChange={(e) => setKeyType(e.target.value as 'rsa' | 'ed25519')}
                    className="form-select"
                  >
                    <option value="ed25519">ED25519 (Recommandé)</option>
                    <option value="rsa">RSA</option>
                  </select>
                  <small className="form-help">
                    ED25519 est plus rapide et sécurisé que RSA
                  </small>
                </div>

                {keyType === 'rsa' && (
                  <div className="form-group">
                    <label>Taille de clé</label>
                    <select 
                      value={keySize} 
                      onChange={(e) => setKeySize(parseInt(e.target.value))}
                      className="form-select"
                    >
                      <option value={2048}>2048 bits</option>
                      <option value={3072}>3072 bits</option>
                      <option value={4096}>4096 bits (Plus sécurisé)</option>
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Passphrase (optionnelle)</label>
                  <div className="password-input-group">
                    <input
                      type={showPassphrase ? 'text' : 'password'}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      placeholder="Laisser vide pour aucune passphrase"
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                    >
                      {showPassphrase ? <RiEyeOffLine /> : <RiEyeLine />}
                    </button>
                  </div>
                  <small className="form-help">
                    Une passphrase ajoute une couche de sécurité supplémentaire
                  </small>
                </div>

                <div className="form-group">
                  <label>Commentaire (optionnel)</label>
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="ex: mon-serveur-prod"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Dossier de sauvegarde</label>
                  <div className="file-input-group">
                    <input
                      type="text"
                      value={saveLocation}
                      readOnly
                      placeholder="Sélectionner un dossier..."
                      className="form-input readonly"
                    />
                    <button
                      type="button"
                      className="browse-button"
                      onClick={selectSaveLocation}
                    >
                      <RiFolderOpenLine />
                    </button>
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="generate-button"
                  onClick={generateSSHKey}
                  disabled={isGenerating || !saveLocation}
                >
                  <RiKey2Line />
                  {isGenerating ? 'Génération...' : 'Générer les clés'}
                </button>
              </div>
            </div>
          ) : (
            // Results Display
            <div className="ssh-keygen-results">
              {generatedKeys.success ? (
                <>
                  <div className="success-message">
                    <FaCheck className="success-icon" />
                    <h4>Clés SSH générées avec succès!</h4>
                    <p>Vos clés ont été sauvegardées dans: <code>{saveLocation}</code></p>
                    {generatedKeys.privateKeyPath && (
                      <div className="file-paths">
                        <small>Fichiers créés:</small>
                        <ul>
                          <li><code>{generatedKeys.privateKeyPath}</code> (clé privée)</li>
                          <li><code>{generatedKeys.publicKeyPath}</code> (clé publique)</li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {generatedKeys.fingerprint && (
                    <div className="key-info">
                      <strong>Fingerprint:</strong> <code>{generatedKeys.fingerprint}</code>
                    </div>
                  )}

                  <div className="key-section">
                    <div className="key-header">
                      <h5>Clé publique</h5>
                      <div className="key-actions">
                        <button
                          className="action-button"
                          onClick={() => copyToClipboard(generatedKeys.publicKey!, 'public')}
                          title="Copier"
                        >
                          {copiedStates.public ? <FaCheck /> : <FaCopy />}
                        </button>
                        <button
                          className="action-button"
                          onClick={() => downloadKey(generatedKeys.publicKey!, `id_${keyType}.pub`)}
                          title="Télécharger"
                        >
                          <RiDownloadLine />
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="key-display"
                      value={generatedKeys.publicKey}
                      readOnly
                      rows={3}
                    />
                    <small className="key-help">
                      Copiez cette clé publique dans ~/.ssh/authorized_keys sur vos serveurs
                    </small>
                  </div>

                  <div className="key-section">
                    <div className="key-header">
                      <h5>Clé privée</h5>
                      <div className="key-actions">
                        <button
                          className="visibility-toggle"
                          onClick={() => setShowPrivateKey(!showPrivateKey)}
                          title={showPrivateKey ? 'Masquer' : 'Afficher'}
                        >
                          {showPrivateKey ? <RiEyeOffLine /> : <RiEyeLine />}
                        </button>
                        <button
                          className="action-button"
                          onClick={() => copyToClipboard(generatedKeys.privateKey!, 'private')}
                          title="Copier"
                        >
                          {copiedStates.private ? <FaCheck /> : <FaCopy />}
                        </button>
                        <button
                          className="action-button"
                          onClick={() => downloadKey(generatedKeys.privateKey!, `id_${keyType}`)}
                          title="Télécharger"
                        >
                          <RiDownloadLine />
                        </button>
                      </div>
                    </div>
                    {showPrivateKey ? (
                      <textarea
                        className="key-display private"
                        value={generatedKeys.privateKey}
                        readOnly
                        rows={8}
                      />
                    ) : (
                      <div className="key-hidden">
                        <FaExclamationTriangle />
                        <span>Clé privée masquée pour sécurité</span>
                      </div>
                    )}
                    <small className="key-help warning">
                      ⚠️ Gardez cette clé privée secrète et ne la partagez jamais!
                    </small>
                  </div>

                  <div className="results-actions">
                    <button className="secondary-button" onClick={resetForm}>
                      Générer d'autres clés
                    </button>
                    <button className="primary-button" onClick={onClose}>
                      Terminer
                    </button>
                  </div>
                </>
              ) : (
                <div className="error-message">
                  <FaExclamationTriangle className="error-icon" />
                  <h4>Erreur lors de la génération</h4>
                  <p>{generatedKeys.error}</p>
                  <button className="secondary-button" onClick={resetForm}>
                    Réessayer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SSHKeyGeneratorModal; 