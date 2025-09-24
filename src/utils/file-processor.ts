import { TransmissionInfo, DataChunk, BatchInfo, QRSenderConfig } from '../types'
import { encodeBase32, createTransmissionQR, createDataQR, createBatchQR, calculateSHA256 } from './protocol'
import { QRGenerator } from './qr-generator'

export class FileProcessor {
  private config: QRSenderConfig

  constructor(config: Partial<QRSenderConfig> = {}) {
    this.config = {
      batchSize: config.batchSize || 10,
      rotationSpeed: config.rotationSpeed || 2000,
      chunkSize: config.chunkSize || QRGenerator.calculateOptimalChunkSize()
    }
  }

  async processFile(file: File): Promise<{
    transmissionInfo: TransmissionInfo
    batches: Array<{
      batchInfo: BatchInfo
      chunks: DataChunk[]
    }>
  }> {
    const fileData = new Uint8Array(await file.arrayBuffer())
    const checksum = await calculateSHA256(fileData)
    const encodedData = encodeBase32(fileData)
    
    const chunks = this.createChunks(encodedData)
    const transmissionInfo: TransmissionInfo = {
      filename: file.name,
      totalChunks: chunks.length,
      checksum,
      fileSize: file.size
    }

    const batches = this.createBatches(chunks)
    
    return { transmissionInfo, batches }
  }

  private createChunks(data: string): DataChunk[] {
    const chunks: DataChunk[] = []
    const chunkSize = this.config.chunkSize - 10

    console.log(`createChunks: data length ${data.length}, chunk size ${chunkSize}, expected ${Math.ceil(data.length / chunkSize)} chunks`)

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunkId = Math.floor(i / chunkSize)
      const chunkData = data.slice(i, i + chunkSize)
      
      chunks.push({
        chunkId,
        data: chunkData
      })
    }

    console.log(`createChunks: created ${chunks.length} chunks`)
    return chunks
  }

  private createBatches(chunks: DataChunk[]): Array<{
    batchInfo: BatchInfo
    chunks: DataChunk[]
  }> {
    const batches: Array<{ batchInfo: BatchInfo; chunks: DataChunk[] }> = []
    const batchSize = this.config.batchSize
    const totalBatches = Math.ceil(chunks.length / batchSize)

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize)
      
      const batchInfo: BatchInfo = {
        startChunk: batchChunks[0].chunkId,
        endChunk: batchChunks[batchChunks.length - 1].chunkId,
        totalBatches,
        batchNumber
      }

      batches.push({ batchInfo, chunks: batchChunks })
    }

    return batches
  }

  async generateQRCodes(transmissionInfo: TransmissionInfo, batch: {
    batchInfo: BatchInfo
    chunks: DataChunk[]
  }): Promise<string[]> {
    const qrCodes: string[] = []
    
    if (batch.batchInfo.batchNumber === 0) {
      const transmissionQR = createTransmissionQR(transmissionInfo)
      qrCodes.push(await QRGenerator.generateQRDataURL(transmissionQR))
    }

    const batchQR = createBatchQR(batch.batchInfo)
    qrCodes.push(await QRGenerator.generateQRDataURL(batchQR))

    for (const chunk of batch.chunks) {
      const dataQR = createDataQR(chunk)
      qrCodes.push(await QRGenerator.generateQRDataURL(dataQR))
    }

    return qrCodes
  }
}