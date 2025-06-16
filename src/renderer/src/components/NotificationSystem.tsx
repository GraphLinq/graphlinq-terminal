import React, { useState, useEffect } from 'react'
import './NotificationSystem.scss'
import { RiCloseLine, RiCheckLine, RiErrorWarningLine, RiInformationLine, RiAlertLine } from 'react-icons/ri'

export interface Notification {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  duration?: number
  timestamp: number
}

interface NotificationSystemProps {
  notifications: Notification[]
  onRemoveNotification: (id: string) => void
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onRemoveNotification
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <RiCheckLine />
      case 'error':
        return <RiErrorWarningLine />
      case 'warning':
        return <RiAlertLine />
      case 'info':
      default:
        return <RiInformationLine />
    }
  }

  const handleClose = (id: string) => {
    onRemoveNotification(id)
  }

  // Auto-remove notifications after their duration
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []

    notifications.forEach((notification) => {
      const duration = notification.duration || 5000 // Default 5 seconds
      const timer = setTimeout(() => {
        onRemoveNotification(notification.id)
      }, duration)
      timers.push(timer)
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [notifications, onRemoveNotification])

  if (notifications.length === 0) {
    return null
  }

  return (
    <div className="notification-system">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification--${notification.type}`}
        >
          <div className="notification__icon">
            {getIcon(notification.type)}
          </div>
          <div className="notification__content">
            <p className="notification__message">{notification.message}</p>
          </div>
          <button
            className="notification__close"
            onClick={() => handleClose(notification.id)}
            title="Close notification"
          >
            <RiCloseLine />
          </button>
        </div>
      ))}
    </div>
  )
}

export default NotificationSystem 