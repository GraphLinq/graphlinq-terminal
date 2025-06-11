# GraphLinq Terminal - AI-Powered SSH Management for Blockchain

A modern Electron application built with React and TypeScript, featuring AI-powered automation and advanced file exploration capabilities designed specifically for blockchain infrastructure management.

## 🚀 Key Features

### 🤖 **AI-Powered Automation**
- **Smart Command Execution** - AI assistant that understands blockchain operations
- **Automated Server Setup** - Deploy Ethereum nodes, validators, and blockchain infrastructure without coding knowledge
- **Intelligent Troubleshooting** - AI analyzes logs and suggests solutions for common blockchain issues
- **Context-Aware Commands** - AI understands your server environment and suggests optimal configurations

### 🔍 **Advanced File Exploration**
- **Integrated File Browser** - Navigate server directories with a modern, intuitive interface
- **Syntax-Highlighted Editor** - Edit configuration files with full syntax highlighting
- **Real-time File Watching** - Monitor log files and configuration changes in real-time
- **Smart File Operations** - AI-guided file management and configuration editing

### ⛓️ **Blockchain-Focused Tools**
- **One-Click Node Deployment** - Install Ethereum, Bitcoin, or other blockchain nodes effortlessly
- **Validator Management** - Set up and monitor staking validators with AI guidance
- **DeFi Infrastructure** - Deploy and manage DeFi protocols and smart contract environments
- **Network Monitoring** - Track node performance, synchronization, and network health

### 🔧 **Professional SSH Management**
- **Multi-Server Management** - Connect to multiple servers simultaneously
- **Secure Authentication** - Support for password and SSH key authentication
- **Session Persistence** - Maintain connections across application restarts
- **Terminal Multiplexing** - Multiple terminal sessions in a single interface

## 🎯 Perfect For

- **Blockchain Enthusiasts** - Run your own Ethereum node without technical expertise
- **DeFi Operators** - Manage validator nodes and staking infrastructure
- **System Administrators** - Automate routine server management tasks
- **Non-Developers** - Access professional server management tools with AI guidance
- **Crypto Projects** - Deploy and maintain blockchain infrastructure efficiently

## 📋 Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- SSH access to your target servers

## 🛠️ Installation

1. Clone the repository or navigate to the project folder
2. Install dependencies:

```bash
npm install
```

## 🚀 Development

To start the application in development mode:

```bash
npm run dev
```

This command will:
- Start the Vite development server for the renderer (React)
- Compile the main TypeScript process
- Launch the Electron application

## 🏗️ Build

To build the application for production:

```bash
npm run build
```

To create a distributable package:

```bash
npm run dist
```

## 📁 Project Structure

```
graphlinq-terminal/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts          # Main entry point
│   │   └── preload.ts       # Preload script
│   └── renderer/            # Renderer process (React)
│       ├── src/
│       │   ├── App.tsx      # Main React component
│       │   ├── components/  # UI Components
│       │   │   ├── Terminal.tsx       # SSH Terminal
│       │   │   ├── FileExplorer.tsx   # File browser
│       │   │   ├── AIAssistant.tsx    # AI chat interface
│       │   │   └── ServerSidebar.tsx  # Server management
│       │   ├── services/    # Core services
│       │   │   ├── aiService.ts       # AI integration
│       │   │   ├── sshService.ts      # SSH connections
│       │   │   └── fileService.ts     # File operations
│       │   └── types/       # TypeScript definitions
│       └── index.html       # HTML template
├── dist/                    # Compiled files
├── package.json
├── tsconfig.json           # TypeScript configuration (renderer)
├── tsconfig.main.json      # TypeScript configuration (main)
├── tsconfig.node.json      # TypeScript configuration (tools)
└── vite.config.ts          # Vite configuration
```

## 🤖 AI Assistant Capabilities

### Blockchain Operations
- **Ethereum Node Setup**: `"Set up an Ethereum full node on Ubuntu"`
- **Validator Configuration**: `"Configure a validator for Ethereum 2.0 staking"`
- **DeFi Deployment**: `"Deploy a Uniswap v3 liquidity pool"`
- **Smart Contract Testing**: `"Set up a Hardhat development environment"`

### System Administration
- **Server Hardening**: `"Secure my Ubuntu server for production use"`
- **Performance Optimization**: `"Optimize my server for blockchain node operations"`
- **Monitoring Setup**: `"Install monitoring tools for my Ethereum node"`
- **Backup Configuration**: `"Set up automated backups for my validator keys"`

### File Management
- **Configuration Editing**: AI opens and explains blockchain configuration files
- **Log Analysis**: AI analyzes node logs and identifies issues
- **Directory Navigation**: AI guides you through complex directory structures
- **Permission Management**: AI helps set correct file permissions for blockchain applications

## 🔧 Available Scripts

- `npm run dev` - Start the application in development mode
- `npm run dev:main` - Compile and start only the main process
- `npm run dev:renderer` - Start only the Vite development server
- `npm run build` - Build the application for production
- `npm run build:main` - Compile only the main process
- `npm run build:renderer` - Build only the renderer
- `npm run dist` - Create a distributable package

## 🔒 Security

This application follows Electron security best practices:

- **Context Isolation** enabled
- **Node Integration** disabled in renderer
- **Preload script** for secure IPC communication
- **SSH Key Management** with secure storage
- **Encrypted credential storage**

## 🌟 Use Cases

### For Blockchain Developers
- Quickly deploy test networks and development environments
- Manage multiple blockchain nodes across different networks
- Automate smart contract deployment and testing workflows

### For DeFi Operators
- Set up and monitor validator nodes with minimal technical knowledge
- Manage staking infrastructure with AI-guided optimization
- Monitor MEV-boost and validator performance metrics

### For System Administrators
- Automate routine server maintenance tasks
- Manage multiple blockchain nodes from a single interface
- Get AI-powered insights for performance optimization

### For Non-Technical Users
- Install and run your own Ethereum node without coding
- Participate in blockchain networks through guided setup
- Manage server infrastructure with natural language commands

## 🎨 Customization

### Adding New Features

1. **Main Process**: Add your logic in `src/main/main.ts`
2. **User Interface**: Create new React components in `src/renderer/src/components/`
3. **IPC Communication**: Extend the API in `src/main/preload.ts` and types in `src/renderer/src/types/`
4. **AI Integration**: Extend AI capabilities in `src/renderer/src/services/aiService.ts`

### Modifying Appearance

- Modify `src/renderer/src/components/*.scss` for component-specific styles
- Modify `src/renderer/src/styles/` for global styles and themes

## 📦 Distribution

The application can be packaged for:
- **Windows**: NSIS installer
- **macOS**: .app application bundle
- **Linux**: AppImage, deb, rpm packages

Build configuration can be found in `package.json` under the `"build"` section.

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Join our Discord community
- Check the documentation wiki

## 📄 License

This project is licensed under the ISC License.

---

**GraphLinq Terminal** - Democratizing blockchain infrastructure management through AI-powered automation. 