export class ErrorHandler {
  static handle(error: unknown, context: string): void {
    console.error(`Error in ${context}:`, error)
    
    const message = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Show user-friendly error messages
    const userMessage = this.getUserFriendlyMessage(message, context)
    this.showNotification(userMessage, 'error')
  }

  static getUserFriendlyMessage(originalMessage: string, context: string): string {
    const errorMap: Record<string, string> = {
      'Camera access denied': 'Please allow camera access to scan QR codes',
      'No camera available': 'No camera found on this device',
      'Failed to generate QR code': 'Error creating QR code - file may be too large',
      'File too large': 'File is too large for QR code transfer',
      'Invalid QR code format': 'Scanned QR code is not valid for file transfer',
      'Checksum mismatch': 'File transfer corrupted - please retry',
      'Missing chunk': 'Some data chunks are missing - please rescan'
    }

    for (const [key, value] of Object.entries(errorMap)) {
      if (originalMessage.includes(key)) {
        return value
      }
    }

    return `${context}: ${originalMessage}`
  }

  static showNotification(message: string, type: 'success' | 'error' | 'warning' = 'error'): void {
    // Simple notification system
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    notification.textContent = message
    
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#ffc107'};
      color: white;
      border-radius: 6px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 1000;
      max-width: 300px;
      word-wrap: break-word;
    `
    
    document.body.appendChild(notification)
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 5000)
  }

  static validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024 // 50MB
    
    if (file.size > maxSize) {
      return { valid: false, error: 'File is too large (max 50MB)' }
    }
    
    if (file.size === 0) {
      return { valid: false, error: 'File is empty' }
    }
    
    return { valid: true }
  }

  static async withRetry<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: unknown
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError
  }
}