import OpenAI from 'openai';
import { sshService } from './sshService';

export interface AIProgressUpdate {
  type: 'thinking' | 'executing' | 'completed' | 'error';
  message: string;
  toolCall?: AIToolCall;
  step?: number;
}

export interface AIWritingUpdate {
  type: 'ai_writing_start' | 'ai_writing_end';
  sessionId: string;
  command?: string;
  description?: string;
}

export interface AIMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  toolCalls?: AIToolCall[];
  commandOutput?: string;
}

export interface AIToolCall {
  id: string;
  function: string;
  arguments: any;
  result?: string;
  status: 'pending' | 'success' | 'error';
}

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
}

export class AIService {
  private openai: OpenAI | null = null;
  private config: AIServiceConfig | null = null;

  constructor() {
    // L'API key sera configurée par l'utilisateur
  }

  configure(config: AIServiceConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  isConfigured(): boolean {
    return this.openai !== null && this.config !== null;
  }

  async sendMessage(
    message: string, 
    sessionId: string | null,
    conversationHistory: AIMessage[] = [],
    onProgress?: (update: AIProgressUpdate) => void
  ): Promise<AIMessage> {
    if (!this.openai || !this.config) {
      throw new Error('AI service not configured. Please add your OpenAI API key.');
    }

    if (!sessionId) {
      throw new Error('No active SSH session. Connect to a server to use the assistant.');
    }

    try {
      // Préparer l'historique des messages pour OpenAI
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `Parle en anglais si l'utilisateur parle en anglais. Sinon prend la langue de l'utilisateur. Vous êtes un assistant IA spécialisé dans l'administration système via SSH. 
          Toujours vérifier sur quelle système d'exploitation vous êtes connecté. Tu n'est pas obligé si tu connait déjà via l'historique de conversation.
          Vous avez accès aux outils suivants pour interagir avec le serveur distant :
          - execute_command : pour exécuter des commandes shell
          - read_file : pour lire le contenu d'un fichier
          - write_file : pour écrire dans un fichier
          - list_directory : pour lister le contenu d'un répertoire
          - open_file_explorer : pour ouvrir l'explorateur de fichiers à un emplacement spécifique
          - open_file_editor : pour ouvrir un fichier dans l'éditeur de code avec coloration syntaxique

          Les deux derniers outils (open_file_explorer et open_file_editor) sont très utiles pour :
          - Montrer à l'utilisateur un répertoire spécifique après avoir créé des fichiers
          - Ouvrir des fichiers de configuration pour les examiner visuellement
          - Afficher des credentials, des logs, ou des fichiers importants
          - Permettre à l'utilisateur de modifier facilement des fichiers de configuration

          Vous pouvez utiliser ces outils en chaîne autant de fois que nécessaire pour accomplir une tâche complexe.
          Par exemple, vous pouvez exécuter "docker ps" pour voir les conteneurs, puis utiliser les résultats 
          pour examiner les logs d'un conteneur spécifique avec "docker logs <container_name>".

          Prend toujours connaissance dans quelle dossier est actuellement le terminal et si l'utilisateur est en sudo ou pas si besoin.
          Tu es autorisé a faire un sudo su si besoin dans demandé a l'utilisateur.
          
          Soyez méthodique et expliquez chaque étape de votre processus.
          Toujours confirmer avant d'exécuter des commandes potentiellement destructives.
          Si ce n'est pas dangereux, execute la commande sans demander confirmation.
          Il faut effectuer la tâche le plus possible sans déranger l'utilisateur.
          Si y a besoin de fichier a télécharger, télécharge le fichier dans le répertoire /tmp/ et l'exécute.
          Si ta besoin d'un lien a jour demande a l'utilisateur de le donner dans le chat.
          Essaye de faire des fichiers par exemple si configure un docker, il faut un fichier avec le mot de passe créer.
          Généralement faire des volumes pour les containers docker si besoin par exemple une base de donnée.
          De préférence quand tu lance un container avec des variables d'environnement, tu les met dans un fichier .env et tu les charge dans le container.
          
          N'hésitez pas à utiliser open_file_explorer et open_file_editor pour améliorer l'expérience utilisateur :
          - Après avoir créé des fichiers de configuration, ouvrez-les avec open_file_editor pour que l'utilisateur puisse les voir
          - Après avoir installé une application dans un répertoire, utilisez open_file_explorer pour montrer l'arborescence
          - Quand vous trouvez des fichiers importants (logs, credentials), ouvrez-les pour faciliter la consultation
          
          IMPORTANT pour open_file_editor : Toujours utiliser le chemin COMPLET et ABSOLU du fichier.
          Par exemple : "/etc/nginx/sites-available/default" et NON "default"
          Vérifiez toujours le répertoire de travail avec pwd si nécessaire avant d'ouvrir un fichier.
          
          Utilisez autant d'appels d'outils que nécessaire pour accomplir la tâche demandée.`
        }
      ];

      // Ajouter l'historique de conversation
      conversationHistory.forEach(msg => {
        if (msg.isUser) {
          messages.push({ role: 'user', content: msg.content });
        } else {
          messages.push({ role: 'assistant', content: msg.content });
        }
      });

      // Ajouter le message actuel
      messages.push({ role: 'user', content: message });

      // Définir les outils disponibles
      const tools: OpenAI.Chat.ChatCompletionTool[] = [
        {
          type: 'function',
          function: {
            name: 'execute_command',
            description: 'Exécute une commande shell sur le serveur distant',
            parameters: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'La commande à exécuter'
                },
                description: {
                  type: 'string',
                  description: 'Description de ce que fait la commande'
                }
              },
              required: ['command', 'description']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'read_file',
            description: 'Lit le contenu d\'un fichier sur le serveur distant',
            parameters: {
              type: 'object',
              properties: {
                filepath: {
                  type: 'string',
                  description: 'Le chemin vers le fichier à lire'
                }
              },
              required: ['filepath']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'write_file',
            description: 'Écrit du contenu dans un fichier sur le serveur distant',
            parameters: {
              type: 'object',
              properties: {
                filepath: {
                  type: 'string',
                  description: 'Le chemin vers le fichier à écrire'
                },
                content: {
                  type: 'string',
                  description: 'Le contenu à écrire dans le fichier'
                },
                append: {
                  type: 'boolean',
                  description: 'Si true, ajoute le contenu à la fin du fichier au lieu de l\'écraser'
                }
              },
              required: ['filepath', 'content']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'list_directory',
            description: 'Liste le contenu d\'un répertoire sur le serveur distant',
            parameters: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Le chemin du répertoire à lister'
                },
                detailed: {
                  type: 'boolean',
                  description: 'Si true, affiche les détails (permissions, taille, date)'
                }
              },
              required: ['path']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'open_file_explorer',
            description: 'Ouvre l\'explorateur de fichiers SSH pour naviguer dans un répertoire spécifique',
            parameters: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Le chemin du répertoire à ouvrir dans l\'explorateur'
                },
                reason: {
                  type: 'string',
                  description: 'Explication de pourquoi ouvrir ce répertoire pour l\'utilisateur'
                }
              },
              required: ['path', 'reason']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'open_file_editor',
            description: 'Ouvre l\'éditeur de code pour un fichier spécifique avec coloration syntaxique',
            parameters: {
              type: 'object',
              properties: {
                filepath: {
                  type: 'string',
                  description: 'Le chemin complet vers le fichier à ouvrir'
                },
                reason: {
                  type: 'string',
                  description: 'Explication de pourquoi ouvrir ce fichier pour l\'utilisateur'
                }
              },
              required: ['filepath', 'reason']
            }
          }
        }
      ];

      // Variables pour la gestion de la chaîne d'outils
      let currentMessages = [...messages];
      let allToolCalls: AIToolCall[] = [];
      let finalContent = '';
      let commandOutput = '';
      const maxIterations = 10; // Limite de sécurité pour éviter les boucles infinies
      let iteration = 0;

      // Boucle pour permettre l'exécution en chaîne d'outils
      while (iteration < maxIterations) {
        iteration++;

        // Inform that AI is thinking
        onProgress?.({
          type: 'thinking',
          message: `🧠 Analyzing request and planning actions (step ${iteration})...`,
          step: iteration
        });

        // Appel à l'API OpenAI
        const completion = await this.openai.chat.completions.create({
          model: this.config.model || 'gpt-4',
          messages: currentMessages,
          tools,
          tool_choice: 'auto'
        });

        const response = completion.choices[0]?.message;
        if (!response) {
          throw new Error('Aucune réponse de l\'API OpenAI');
        }

        // If no tool calls, we have the final response
        if (!response.tool_calls || response.tool_calls.length === 0) {
          finalContent = response.content || '';
          onProgress?.({
            type: 'completed',
            message: '📝 Analysis completed, preparing final response...',
            step: iteration
          });
          break;
        }

        // Inform about tools to be executed
        const toolNames = response.tool_calls.map(tc => tc.function.name).join(', ');
        onProgress?.({
          type: 'thinking',
          message: `🔧 ${response.tool_calls.length} tool(s) planned: ${toolNames}`,
          step: iteration
        });

        // Ajouter la réponse de l'assistant aux messages
        currentMessages.push({
          role: 'assistant',
          content: response.content,
          tool_calls: response.tool_calls
        });

        // Exécuter les outils demandés dans cette itération
        for (let i = 0; i < response.tool_calls.length; i++) {
          const toolCall = response.tool_calls[i];
          const args = JSON.parse(toolCall.function.arguments);
          const toolCallInfo: AIToolCall = {
            id: toolCall.id,
            function: toolCall.function.name,
            arguments: args,
            status: 'pending'
          };

          // Créer un message détaillé selon le type d'outil
          let detailedMessage = '';
          switch (toolCall.function.name) {
            case 'execute_command':
              detailedMessage = `💻 \`${args.command}\``;
              break;
            case 'read_file':
              detailedMessage = `📖 \`${args.filepath}\``;
              break;
            case 'write_file':
              const writeAction = args.append ? 'Appending to' : 'Writing to';
              const contentPreview = args.content.length > 30 ? args.content.substring(0, 30) + '...' : args.content;
              detailedMessage = `✏️ ${writeAction} \`${args.filepath}\`\n${contentPreview}`;
              break;
            case 'list_directory':
              const listMode = args.detailed ? 'detailed' : 'simple';
              detailedMessage = `📂 Listing ${listMode} \`${args.path}\``;
              break;
            default:
              detailedMessage = `🔧 ${toolCall.function.name}`;
          }

          // Inform about tool execution start with details
          onProgress?.({
            type: 'executing',
            message: detailedMessage,
            toolCall: toolCallInfo,
            step: iteration
          });

          try {
            const result = await this.executeFunction(
              toolCall.function.name,
              args,
              sessionId
            );
            
            toolCallInfo.result = result;
            toolCallInfo.status = 'success';
            commandOutput += `\n🔧 ${toolCall.function.name} (Étape ${iteration}):\n${result}\n`;

            // Create success message with result preview
            let successMessage = '';
            const resultPreview = result.length > 100 ? result.substring(0, 100) + '...' : result;
            
            switch (toolCall.function.name) {
              case 'execute_command':
                const lines = result.split('\n').filter(line => line.trim()).length;
                successMessage = `✅ \`${args.command}\` (${lines} lines)\n\`\`\`\n${resultPreview}\n\`\`\``;
                break;
              case 'read_file':
                const fileSize = result.length;
                successMessage = `✅ \`${args.filepath}\` (${fileSize} chars)\n\`\`\`\n${resultPreview}\n\`\`\``;
                break;
              case 'write_file':
                successMessage = `✅ \`${args.filepath}\` ${args.append ? 'modified' : 'created'}`;
                break;
              case 'list_directory':
                const items = result.split('\n').filter(line => line.trim()).length;
                successMessage = `✅ \`${args.path}\` (${items} items)\n\`\`\`\n${resultPreview}\n\`\`\``;
                break;
              default:
                successMessage = `✅ ${toolCall.function.name}\n\`\`\`\n${resultPreview}\n\`\`\``;
            }

            // Inform about successful execution with details
            onProgress?.({
              type: 'completed',
              message: successMessage,
              toolCall: toolCallInfo,
              step: iteration
            });

            // Ajouter le résultat de l'outil aux messages
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: result
            });

          } catch (error: any) {
            toolCallInfo.result = error.message;
            toolCallInfo.status = 'error';
            commandOutput += `\n❌ Error ${toolCall.function.name} (Step ${iteration}): ${error.message}\n`;

            // Inform about error with details
            onProgress?.({
              type: 'error',
              message: `❌ Error executing \`${toolCall.function.name}\`\n🚨 Details: ${error.message}\n🔧 Parameters used: ${JSON.stringify(args)}`,
              toolCall: toolCallInfo,
              step: iteration
            });

            // Ajouter l'erreur aux messages pour que l'IA puisse réagir
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Erreur: ${error.message}`
            });
          }

          allToolCalls.push(toolCallInfo);
        }

        // Inform that step is completed with summary
        const successCount = response.tool_calls ? response.tool_calls.filter((_, i) => allToolCalls[allToolCalls.length - response.tool_calls!.length + i]?.status === 'success').length : 0;
        const errorCount = response.tool_calls ? response.tool_calls.length - successCount : 0;
        
        onProgress?.({
          type: 'completed',
          message: `📊 Step ${iteration} completed: ${successCount} success, ${errorCount} error(s)\n🤔 Analyzing results to determine next actions...`,
          step: iteration
        });

        // If we reach the last iteration, force a final response
        if (iteration >= maxIterations - 1) {
          onProgress?.({
            type: 'thinking',
            message: `📝 Iteration limit reached (${maxIterations})\n✍️ Generating final summary of all actions performed...`,
            step: iteration + 1
          });

          const finalCompletion = await this.openai.chat.completions.create({
            model: this.config.model || 'gpt-4',
            messages: [
              ...currentMessages,
              {
                role: 'user',
                content: 'Please provide a final summary of all actions performed and their results.'
              }
            ]
          });

          const finalResponse = finalCompletion.choices[0]?.message;
          if (finalResponse?.content) {
            finalContent = finalResponse.content;
          }
          break;
        }
      }

      // Inform that everything is completed
      const totalSuccess = allToolCalls.filter(tc => tc.status === 'success').length;
      const totalErrors = allToolCalls.filter(tc => tc.status === 'error').length;
      
      onProgress?.({
        type: 'completed',
        message: `🎉 Operation completed successfully!\n📈 Summary: ${totalSuccess} successful action(s), ${totalErrors} error(s)\n📋 ${iteration} analysis step(s) performed`,
        step: iteration
      });

      // Create final response message
      const aiMessage: AIMessage = {
        id: Date.now().toString(),
        content: finalContent || 'Operation completed',
        isUser: false,
        timestamp: new Date(),
        toolCalls: allToolCalls,
        commandOutput: commandOutput || undefined
      };

      return aiMessage;

    } catch (error: any) {
      throw new Error(`Error calling OpenAI API: ${error.message}`);
    }
  }

  private async executeFunction(functionName: string, args: any, sessionId: string): Promise<string> {
    switch (functionName) {
      case 'execute_command':
        return this.executeCommand(args.command, args.description, sessionId);
      
      case 'read_file':
        return this.readFile(args.filepath, sessionId);
      
      case 'write_file':
        return this.writeFile(args.filepath, args.content, args.append || false, sessionId);
      
      case 'list_directory':
        return this.listDirectory(args.path, args.detailed || false, sessionId);
      
      case 'open_file_explorer':
        return this.openFileExplorer(args.path, args.reason);
      
      case 'open_file_editor':
        return this.openFileEditor(args.filepath, args.reason);
      
      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  private async executeCommand(command: string, description: string, sessionId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let timeoutId: NodeJS.Timeout;
      let inactivityTimeoutId: NodeJS.Timeout;
      let isListening = false;
      let lastOutputTime = Date.now();
      let promptDetected = false;
      let initialPromptSeen = false;
      let confirmationSent = false;
      let commandExecuted = false;

      // Notify that AI is starting to write
      if (window.electronAPI?.notifyAIWriting) {
        window.electronAPI.notifyAIWriting({
          type: 'ai_writing_start',
          sessionId,
          command,
          description
        });
      }

      // Fonction pour collecter les données SSH spécifiquement pour cette commande
      const collectOutput = (sessionIdParam: string, data: string) => {
        if (sessionIdParam === sessionId && isListening) {
          output += data;
          lastOutputTime = Date.now();
          
          // Reset inactivity timeout à chaque nouvelle donnée
          if (inactivityTimeoutId) {
            clearTimeout(inactivityTimeoutId);
          }
          inactivityTimeoutId = setTimeout(checkInactivity, 15000); // Réduit à 15 secondes
          
          // Détecter le prompt initial (avant la commande)
          if (!initialPromptSeen && (data.includes('$') || data.includes('#') || data.includes('>'))) {
            initialPromptSeen = true;
            return;
          }
          
          // Marquer que la commande a été exécutée si on voit la commande dans la sortie
          if (!commandExecuted && output.includes(command)) {
            commandExecuted = true;
          }
          
          // Détecter les demandes de confirmation interactives
          if (!confirmationSent && initialPromptSeen) {
            const confirmationPatterns = [
              /Do you want to continue\? \[Y\/n\]/i,
              /Continue \[Y\/n\]\?/i,
              /\[Y\/n\]/i,
              /\(y\/N\)/i,
              /\(Y\/n\)/i,
              /Press Y to continue/i,
              /Proceed with installation\? \[Y\/n\]/i,
              /Are you sure\? \[y\/N\]/i
            ];
            
            for (const pattern of confirmationPatterns) {
              if (pattern.test(data)) {
                confirmationSent = true;
                setTimeout(() => {
                  if (window.electronAPI?.sshWrite) {
                    window.electronAPI.sshWrite(sessionId, 'Y\n');
                  }
                }, 500);
                return;
              }
            }
          }
          
          // Détecter le retour du prompt après l'exécution de la commande
          if (initialPromptSeen && commandExecuted && !promptDetected) {
            // Patterns de prompt plus robustes
            const promptPatterns = [
              /\n[^@]*[@#$>]\s*$/,  // Prompt à la fin d'une ligne avec utilisateur
              /\n.*[@#$>]\s*\x1b/,  // Prompt avec séquences ANSI
              /[@#$>]\s*$/,  // Simple prompt à la fin
              /\$\s*$/,  // Simple $ prompt
              /#\s*$/,   // Simple # prompt (root)
              />\s*$/,   // Simple > prompt
              /~\s*\$\s*$/,  // Prompt avec tilde
              /]\s*\$\s*$/   // Prompt avec brackets
            ];
            
            for (const pattern of promptPatterns) {
              if (pattern.test(output)) {
                promptDetected = true;
                // Attendre moins longtemps pour être plus réactif
                setTimeout(() => {
                  cleanup();
                  resolve(cleanOutput());
                }, 200);
                return;
              }
            }
          }
        }
      };

      const cleanOutput = () => {
        // Nettoyer la sortie pour éviter les doublons et les séquences de contrôle
        let cleanedOutput = output
          .replace(/\r\n/g, '\n')
          .replace(/\r/g, '\n')
          // Supprimer les séquences ANSI de base
          .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
          // Supprimer la commande elle-même si elle apparaît au début
          .replace(new RegExp(`^.*${command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*\n?`), '')
          // Supprimer les prompts finaux
          .replace(/\n.*[@#$>]\s*$/, '')
          // Supprimer les lignes vides en début et fin
          .replace(/^\n+/, '')
          .replace(/\n+$/, '')
          .split('\n')
          .filter((line, index, arr) => {
            // Éviter les lignes dupliquées consécutives
            return index === 0 || line !== arr[index - 1];
          })
          .filter(line => line.trim() !== '') // Supprimer les lignes vides
          .join('\n')
          .trim();

        // Format the final result
        if (cleanedOutput) {
          return `✅ ${description}\n\`\`\`bash\n$ ${command}\n\`\`\`\n\n**Result:**\n\`\`\`\n${cleanedOutput}\n\`\`\``;
        } else {
          return `✅ ${description}\n\`\`\`bash\n$ ${command}\n\`\`\`\n\n**Result:** Command executed successfully${confirmationSent ? ' (automatic confirmation sent)' : ''}`;
        }
      };

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
        isListening = false;
        
        // Notify that AI has finished writing
        if (window.electronAPI?.notifyAIWriting) {
          window.electronAPI.notifyAIWriting({
            type: 'ai_writing_end',
            sessionId
          });
        }
      };

      // Timeout de détection d'inactivité
      const checkInactivity = () => {
        if (isListening) {
          const timeSinceLastOutput = Date.now() - lastOutputTime;
          
          // Si pas de sortie depuis 15 secondes et qu'on a du contenu ou que la commande a été exécutée
          if (timeSinceLastOutput >= 15000 && (output.trim() || commandExecuted)) {
            cleanup();
            resolve(cleanOutput());
            return;
          }
        }
      };

      // Commencer à écouter les données
      isListening = true;
      if (window.electronAPI?.onSSHData) {
        window.electronAPI.onSSHData(collectOutput);
      }

      // Timeout principal pour éviter les commandes qui traînent
      timeoutId = setTimeout(() => {
        cleanup();
        if (output.trim()) {
          resolve(cleanOutput()); // Return what we have even if timeout
        } else {
          reject(new Error(`Timeout: Command '${command}' took more than 5 minutes to execute`));
        }
      }, 300000); // 5 minutes

      // Exécuter la commande
      sshService.write(sessionId, command + '\n').then((result) => {
        if (!result.success) {
          cleanup();
          reject(new Error(result.error || 'Error writing command'));
          return;
        }

        // Démarrer la surveillance d'inactivité après l'envoi de la commande
        inactivityTimeoutId = setTimeout(checkInactivity, 15000);
        
      }).catch((error) => {
        cleanup();
        reject(error);
      });
    });
  }

  private async readFile(filepath: string, sessionId: string): Promise<string> {
    return this.executeCommand(`cat "${filepath}"`, `Reading file ${filepath}`, sessionId);
  }

  private async writeFile(filepath: string, content: string, append: boolean, sessionId: string): Promise<string> {
    const operator = append ? '>>' : '>';
    const command = `cat ${operator} "${filepath}" << 'EOF'
${content}
EOF`;
    const description = append ? 
      `Adding content to file ${filepath}` : 
      `Writing to file ${filepath}`;
    
    return this.executeCommand(command, description, sessionId);
  }

  private async listDirectory(path: string, detailed: boolean, sessionId: string): Promise<string> {
    const command = detailed ? `ls -la "${path}"` : `ls "${path}"`;
    const description = `Listing directory contents of ${path}`;
    
    return this.executeCommand(command, description, sessionId);
  }

  private async openFileExplorer(path: string, reason: string): Promise<string> {
    try {
      // Dispatch event to open file explorer
      const event = new CustomEvent('ai-open-file-explorer', {
        detail: { path, reason }
      });
      window.dispatchEvent(event);
      
      return `📂 File explorer opened for directory: ${path}\n💡 Reason: ${reason}`;
    } catch (error: any) {
      throw new Error(`Error opening file explorer: ${error.message}`);
    }
  }

  private async openFileEditor(filepath: string, reason: string): Promise<string> {
    try {
      // Dispatch event to open file editor
      const event = new CustomEvent('ai-open-file-editor', {
        detail: { filepath, reason }
      });
      window.dispatchEvent(event);
      
      return `📝 Code editor opened for file: ${filepath}\n💡 Reason: ${reason}`;
    } catch (error: any) {
      throw new Error(`Error opening code editor: ${error.message}`);
    }
  }
}

export const aiService = new AIService();