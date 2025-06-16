import React, { Component, ErrorInfo, ReactNode } from 'react'
import { LoadedPlugin } from '../../types/plugin'
import './PluginContainer.scss'

interface PluginContainerProps {
  plugin: LoadedPlugin
  children: ReactNode
}

interface PluginContainerState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Error boundary component for plugin isolation
 */
export class PluginContainer extends Component<PluginContainerProps, PluginContainerState> {
  constructor(props: PluginContainerProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): PluginContainerState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Plugin ${this.props.plugin.manifest.name} crashed:`, error, errorInfo)
    this.setState({ error, errorInfo })
  }

  componentDidMount() {
    // Log plugin container mount
    console.log(`Plugin container mounted for: ${this.props.plugin.manifest.displayName}`)
  }

  componentWillUnmount() {
    // Log plugin container unmount
    console.log(`Plugin container unmounted for: ${this.props.plugin.manifest.displayName}`)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleReload = () => {
    // This would trigger a plugin reload
    console.log(`Reloading plugin: ${this.props.plugin.manifest.name}`)
    window.location.reload()
  }

  render() {
    const { plugin, children } = this.props
    const { hasError, error } = this.state

    if (hasError) {
      return (
        <div className="plugin-container plugin-container--error">
          <div className="plugin-error">
            <div className="plugin-error__header">
              <div className="plugin-error__icon">⚠️</div>
              <div className="plugin-error__title">Plugin Error</div>
            </div>
            
            <div className="plugin-error__content">
              <div className="plugin-error__plugin-info">
                <strong>{plugin.manifest.displayName}</strong>
                <span className="plugin-error__version">v{plugin.manifest.version}</span>
              </div>
              
              <div className="plugin-error__message">
                {error?.message || 'An unknown error occurred in this plugin'}
              </div>
              
              <div className="plugin-error__details">
                <details>
                  <summary>Error Details</summary>
                  <pre className="plugin-error__stack">
                    {error?.stack || 'No stack trace available'}
                  </pre>
                </details>
              </div>
            </div>
            
            <div className="plugin-error__actions">
              <button 
                className="plugin-error__button plugin-error__button--primary"
                onClick={this.handleRetry}
              >
                Retry
              </button>
              <button 
                className="plugin-error__button plugin-error__button--secondary"
                onClick={this.handleReload}
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div 
        className={`plugin-container ${!plugin.enabled ? 'plugin-container--disabled' : ''}`}
        data-plugin-id={plugin.id}
        data-plugin-name={plugin.manifest.displayName}
      >
        {children}
      </div>
    )
  }
}

/**
 * Hook-based wrapper for functional components
 */
interface PluginWrapperProps {
  plugin: LoadedPlugin
  children: ReactNode
}

export const PluginWrapper: React.FC<PluginWrapperProps> = ({ plugin, children }) => {
  return (
    <PluginContainer plugin={plugin}>
      {children}
    </PluginContainer>
  )
}

export default PluginContainer 