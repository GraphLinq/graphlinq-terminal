# Docker Manager Plugin

A comprehensive Docker management plugin for GraphLinq Terminal that allows you to manage Docker containers, images, and networks directly from the terminal interface.

## Features

- **Container Management**: Start, stop, restart, and remove Docker containers
- **Image Management**: View, pull, and remove Docker images
- **Real-time Status**: Live updates of container and image status
- **Sidebar Integration**: Dedicated Docker panel in the sidebar
- **Notifications**: Real-time feedback for all operations
- **Persistent Settings**: Save and restore plugin preferences

## Requirements

- GraphLinq Terminal v1.0.0 or higher
- Docker installed on the target server
- SSH connection to a server with Docker access

## Installation

1. Download the plugin files
2. Extract to `plugins/docker-manager/` directory
3. Restart GraphLinq Terminal
4. The plugin will be automatically loaded

## Permissions

This plugin requires the following permissions:

- `terminal.execute` - Execute Docker commands
- `terminal.read` - Read terminal output
- `ui.sidebar` - Add Docker panel to sidebar
- `ui.notification` - Show status notifications
- `storage.local` - Save plugin preferences

## Usage

### Basic Operations

1. **Connect to a server** with Docker installed
2. **Open the Docker panel** from the sidebar
3. **Refresh** to load current containers and images
4. **Manage containers** using the action buttons

### Container Management

- **Start Container**: Click the start button next to a stopped container
- **Stop Container**: Click the stop button next to a running container
- **Remove Container**: Click the remove button (container must be stopped first)
- **View Logs**: Double-click a container to view its logs

### Image Management

- **Pull Image**: Use the pull button to download new images
- **Remove Image**: Remove unused images to free up space
- **View Details**: Click on an image to see detailed information

## Configuration

The plugin saves preferences automatically, including:

- Auto-refresh interval (default: 30 seconds)
- Show system containers (default: false)
- Panel position and size

## Commands

The plugin executes the following Docker commands:

```bash
# Check Docker availability
docker --version

# List containers
docker ps -a --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}"

# List images
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}"

# Container operations
docker start <container_id>
docker stop <container_id>
docker rm <container_id>
docker logs <container_id>

# Image operations
docker pull <image_name>
docker rmi <image_id>
```

## Development

### Plugin Structure

```
docker-manager/
├── manifest.json       # Plugin metadata
├── index.js           # Main plugin code
├── README.md          # Documentation
└── components/        # React components (future)
    ├── DockerPanel.tsx
    ├── ContainerList.tsx
    └── ImageList.tsx
```

### API Usage

The plugin demonstrates usage of the GraphLinq Terminal Plugin API:

```javascript
// Terminal API
const result = await sdk.terminal.execute('docker ps')

// UI API
const panelId = sdk.ui.addSidebarPanel({
  id: 'docker-panel',
  title: 'Docker',
  component: DockerPanel
})

// Notification API
sdk.ui.showNotification('Container started!', 'success')

// Storage API
await sdk.storage.set('preferences', { autoRefresh: true })
const prefs = await sdk.storage.get('preferences')
```

### Lifecycle Hooks

```javascript
// Called when plugin loads
async onLoad(sdk) {
  // Initialize plugin
}

// Called when plugin unloads
async onUnload() {
  // Cleanup resources
}

// Called when server connects
async onServerConnect(serverInfo) {
  // Handle new connection
}

// Called when server disconnects
async onServerDisconnect() {
  // Handle disconnection
}
```

## Troubleshooting

### Docker Not Found

If you see "Docker not found on this server":

1. Ensure Docker is installed on the target server
2. Check that the user has permission to run Docker commands
3. Verify Docker daemon is running: `sudo systemctl status docker`

### Permission Denied

If you get permission errors:

1. Add user to docker group: `sudo usermod -aG docker $USER`
2. Restart the SSH session
3. Test with: `docker ps`

### Plugin Not Loading

If the plugin doesn't appear:

1. Check the plugin directory structure
2. Verify `manifest.json` is valid JSON
3. Check browser console for error messages
4. Ensure all required permissions are granted

## Contributing

To contribute to this plugin:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and bug reports:

- GitHub Issues: [Plugin Repository](https://github.com/graphlinq/terminal-plugins)
- Discord: [GraphLinq Community](https://discord.gg/graphlinq)
- Documentation: [Plugin Development Guide](https://docs.graphlinq.io/terminal/plugins)

## Changelog

### v1.0.0
- Initial release
- Basic container and image management
- Sidebar panel integration
- Notification system
- Persistent preferences 