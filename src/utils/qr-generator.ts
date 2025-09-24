import QRCode from 'qrcode'

export class QRGenerator {
  private static readonly DEFAULT_OPTIONS = {
    errorCorrectionLevel: 'L' as const,
    type: 'image/png' as const,
    quality: 0.92,
    margin: 1,
    width: 512,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  }

  static async generateQRDataURL(data: string, size = 512): Promise<string> {
    try {
      return await QRCode.toDataURL(data, {
        ...this.DEFAULT_OPTIONS,
        width: size
      })
    } catch (error) {
      console.error('QR generation failed:', error)
      throw new Error('Failed to generate QR code')
    }
  }

  static async generateQRCanvas(data: string, canvas: HTMLCanvasElement): Promise<void> {
    try {
      await QRCode.toCanvas(canvas, data, this.DEFAULT_OPTIONS)
    } catch (error) {
      console.error('QR canvas generation failed:', error)
      throw new Error('Failed to generate QR code on canvas')
    }
  }

  static getMaxCapacity(): number {
    return 2953
  }

  static calculateOptimalChunkSize(): number {
    const maxCapacity = this.getMaxCapacity()
    const overhead = 50
    return maxCapacity - overhead
  }
}