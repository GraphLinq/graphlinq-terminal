import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

// Type pour les options du terminal
interface TerminalOptions {
  ai?: {
    openaiApiKey?: string;
    model?: string;
  };
}

// Chemin du fichier de configuration
const configPath = path.join(app.getPath('userData'), 'terminal-options.json');

// Fonction pour charger les options
function loadOptions(): TerminalOptions {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des options du terminal:', error);
  }
  
  return {};
}

// Fonction pour sauvegarder les options
function saveOptions(options: TerminalOptions): void {
  try {
    fs.writeFileSync(configPath, JSON.stringify(options, null, 2), 'utf8');
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des options du terminal:', error);
  }
}

// Initialiser les gestionnaires IPC
export function initTerminalOptionsHandlers(): void {
  // Gestionnaire pour sauvegarder les options
  ipcMain.handle('terminal:saveOptions', async (_, options: TerminalOptions) => {
    saveOptions(options);
  });
  
  // Gestionnaire pour récupérer les options
  ipcMain.handle('terminal:getOptions', async () => {
    return loadOptions();
  });
} 