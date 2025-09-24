import { QRProtocol, TransmissionInfo, DataChunk, BatchInfo } from '../types'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
// const BASE36_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function encodeBase32(data: Uint8Array): string {
  let result = ''
  let bits = 0
  let value = 0

  for (const byte of data) {
    value = (value << 8) | byte
    bits += 8

    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return result
}

export function decodeBase32(encoded: string): Uint8Array {
  const data: number[] = []
  let bits = 0
  let value = 0

  for (const char of encoded.toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) continue

    value = (value << 5) | index
    bits += 5

    if (bits >= 8) {
      data.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return new Uint8Array(data)
}

export function encodeBase36(num: number): string {
  return num.toString(36).toUpperCase()
}

export function decodeBase36(encoded: string): number {
  return parseInt(encoded, 36)
}

export function createTransmissionQR(info: TransmissionInfo): string {
  const filename = btoa(info.filename)
  return `T${filename}|${info.totalChunks}|${info.checksum}|${info.fileSize}`
}

export function createDataQR(chunk: DataChunk): string {
  const chunkId = encodeBase36(chunk.chunkId)
  const result = `D${chunkId}|${chunk.data}`
  console.log(`createDataQR: chunk ${chunk.chunkId}, data length ${chunk.data.length}, QR length ${result.length}`)
  return result
}

export function createBatchQR(batch: BatchInfo): string {
  const start = encodeBase36(batch.startChunk)
  const end = encodeBase36(batch.endChunk)
  const total = encodeBase36(batch.totalBatches)
  const current = encodeBase36(batch.batchNumber)
  return `B${start}|${end}|${total}|${current}`
}

export function parseQR(qrData: string): QRProtocol | null {
  console.log('=== parseQR DEBUG ===')
  console.log('Input data:', qrData)
  console.log('Input length:', qrData?.length)
  
  if (!qrData || qrData.length === 0) {
    console.log('ERROR: empty or null data')
    return null
  }
  
  const type = qrData[0] as 'T' | 'D' | 'B'
  console.log('Detected type:', type)
  console.log('Valid types:', ['T', 'D', 'B'].includes(type))
  
  if (!['T', 'D', 'B'].includes(type)) {
    console.log('ERROR: invalid type, first char is:', qrData.charCodeAt(0))
    return null
  }
  
  const data = qrData.slice(1)
  console.log('Extracted data:', data)
  console.log('Data length:', data.length)
  
  const result = { type, data }
  console.log('Final result:', JSON.stringify(result, null, 2))
  console.log('=== END parseQR DEBUG ===')
  return result
}

export function parseTransmissionQR(data: string): TransmissionInfo | null {
  try {
    const parts = data.split('|')
    if (parts.length !== 4) return null
    
    return {
      filename: atob(parts[0]),
      totalChunks: parseInt(parts[1]),
      checksum: parts[2],
      fileSize: parseInt(parts[3])
    }
  } catch {
    return null
  }
}

export function parseDataQR(data: string): DataChunk | null {
  try {
    const pipeIndex = data.indexOf('|')
    if (pipeIndex === -1) return null
    
    const chunkId = decodeBase36(data.slice(0, pipeIndex))
    const chunkData = data.slice(pipeIndex + 1)
    
    return {
      chunkId,
      data: chunkData
    }
  } catch {
    return null
  }
}

export function parseBatchQR(data: string): BatchInfo | null {
  try {
    const parts = data.split('|')
    if (parts.length !== 4) return null
    
    return {
      startChunk: decodeBase36(parts[0]),
      endChunk: decodeBase36(parts[1]),
      totalBatches: decodeBase36(parts[2]),
      batchNumber: decodeBase36(parts[3])
    }
  } catch {
    return null
  }
}

export async function calculateSHA256(data: Uint8Array): Promise<string> {
  // Create a new ArrayBuffer to ensure compatibility
  const buffer = new ArrayBuffer(data.length)
  const view = new Uint8Array(buffer)
  view.set(data)
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}