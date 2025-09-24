export interface QRProtocol {
  type: 'T' | 'D' | 'B'
  data: string
}

export interface TransmissionInfo {
  filename: string
  totalChunks: number
  checksum: string
  fileSize: number
}

export interface DataChunk {
  chunkId: number
  data: string
}

export interface BatchInfo {
  startChunk: number
  endChunk: number
  totalBatches: number
  batchNumber: number
}

export interface FileTransferState {
  transmissionInfo?: TransmissionInfo
  chunks: Map<number, string>
  currentBatch?: BatchInfo
  receivedChunks: Set<number>
  missingChunks: Set<number>
  isComplete: boolean
}

export interface QRSenderConfig {
  batchSize: number
  rotationSpeed: number
  chunkSize: number
}