<template>
  <div class="qr-receiver">
    <div class="receiver-header">
      <h2>File Receiver</h2>
      <div v-if="!isReceiving" class="start-section">
        <button @click="startReceiving" class="start-btn">
          Start Receiving
        </button>
      </div>
    </div>

    <div v-if="isReceiving" class="receiver-content">
      <QRScanner @qr-scanned="handleQRScanned" />
      
      <div v-if="fileState.transmissionInfo" class="transmission-info">
        <h3>Receiving: {{ fileState.transmissionInfo.filename }}</h3>
        <div class="file-stats">
          <p>Size: {{ formatFileSize(fileState.transmissionInfo.fileSize) }}</p>
          <p>Total Chunks: {{ fileState.transmissionInfo.totalChunks }}</p>
        </div>
      </div>

      <div v-if="fileState.currentBatch" class="batch-info">
        <h4>Current Batch</h4>
        <p>Batch {{ fileState.currentBatch.batchNumber + 1 }} of {{ fileState.currentBatch.totalBatches }}</p>
        <p>Chunks {{ fileState.currentBatch.startChunk }} - {{ fileState.currentBatch.endChunk }}</p>
        
        <div class="batch-progress">
          <div class="batch-progress-bar">
            <div 
              class="batch-progress-fill" 
              :style="{ width: batchProgressPercent + '%' }"
            ></div>
          </div>
          <span>{{ receivedInCurrentBatch }} / {{ currentBatchSize }} received</span>
        </div>
      </div>

      <div class="overall-progress">
        <h4>Overall Progress</h4>
        <div class="progress-stats">
          <p>Received: {{ fileState.receivedChunks.size }} / {{ fileState.transmissionInfo?.totalChunks || 0 }}</p>
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: overallProgressPercent + '%' }"
            ></div>
          </div>
          <span>{{ Math.round(overallProgressPercent) }}%</span>
        </div>
      </div>

      <div v-if="fileState.missingChunks.size > 0" class="missing-chunks">
        <h4>Missing Chunks</h4>
        <div class="missing-list">
          {{ Array.from(fileState.missingChunks).slice(0, 10).join(', ') }}
          <span v-if="fileState.missingChunks.size > 10">
            ... and {{ fileState.missingChunks.size - 10 }} more
          </span>
        </div>
      </div>

      <div class="receiver-controls">
        <button @click="nextBatch" :disabled="!canNextBatch" class="batch-btn">
          Next Batch
        </button>
        <button @click="resetReceiver" class="reset-btn">
          Reset
        </button>
        <button 
          @click="downloadFile" 
          :disabled="!fileState.isComplete"
          class="download-btn"
        >
          Download File
        </button>
      </div>

      <div v-if="verificationStatus" class="verification-status" :class="verificationStatus.type">
        <p>{{ verificationStatus.message }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import QRScanner from './QRScanner.vue'
import { FileTransferState, QRProtocol } from '../types'
import { 
  parseTransmissionQR, 
  parseDataQR, 
  parseBatchQR, 
  decodeBase32,
  calculateSHA256 
} from '../utils/protocol'

const isReceiving = ref(false)
const verificationStatus = ref<{ type: 'success' | 'error', message: string } | null>(null)

const fileState = reactive<FileTransferState>({
  chunks: new Map(),
  receivedChunks: new Set(),
  missingChunks: new Set(),
  isComplete: false
})

const currentBatchSize = computed(() => {
  if (!fileState.currentBatch) return 0
  return fileState.currentBatch.endChunk - fileState.currentBatch.startChunk + 1
})

const receivedInCurrentBatch = computed(() => {
  if (!fileState.currentBatch) return 0
  let count = 0
  for (let i = fileState.currentBatch.startChunk; i <= fileState.currentBatch.endChunk; i++) {
    if (fileState.receivedChunks.has(i)) count++
  }
  return count
})

const batchProgressPercent = computed(() => {
  if (currentBatchSize.value === 0) return 0
  return (receivedInCurrentBatch.value / currentBatchSize.value) * 100
})

const overallProgressPercent = computed(() => {
  if (!fileState.transmissionInfo) return 0
  return (fileState.receivedChunks.size / fileState.transmissionInfo.totalChunks) * 100
})

const canNextBatch = computed(() => {
  return fileState.currentBatch && 
         receivedInCurrentBatch.value === currentBatchSize.value &&
         fileState.currentBatch.batchNumber < fileState.currentBatch.totalBatches - 1
})

function startReceiving() {
  isReceiving.value = true
  verificationStatus.value = null
}

function handleQRScanned(result: QRProtocol & { rawData: string }) {
  try {
    switch (result.type) {
      case 'T':
        handleTransmissionInfo(result.data)
        break
      case 'B':
        handleBatchInfo(result.data)
        break
      case 'D':
        handleDataChunk(result.data)
        break
    }
    
    checkCompletion()
  } catch (error) {
    console.error('Error processing QR:', error)
  }
}

function handleTransmissionInfo(data: string) {
  const info = parseTransmissionQR(data)
  if (info) {
    fileState.transmissionInfo = info
    console.log('Transmission info received:', info)
  }
}

function handleBatchInfo(data: string) {
  const batch = parseBatchQR(data)
  if (batch) {
    fileState.currentBatch = batch
    updateMissingChunks()
    console.log('Batch info received:', batch)
  }
}

function handleDataChunk(data: string) {
  const chunk = parseDataQR(data)
  if (chunk) {
    fileState.chunks.set(chunk.chunkId, chunk.data)
    fileState.receivedChunks.add(chunk.chunkId)
    fileState.missingChunks.delete(chunk.chunkId)
    console.log('Data chunk received:', chunk.chunkId)
  }
}

function updateMissingChunks() {
  if (!fileState.currentBatch) return
  
  fileState.missingChunks.clear()
  for (let i = fileState.currentBatch.startChunk; i <= fileState.currentBatch.endChunk; i++) {
    if (!fileState.receivedChunks.has(i)) {
      fileState.missingChunks.add(i)
    }
  }
}

function checkCompletion() {
  if (!fileState.transmissionInfo) return
  
  fileState.isComplete = fileState.receivedChunks.size === fileState.transmissionInfo.totalChunks
  
  if (fileState.isComplete) {
    verifyFile()
  }
}

async function verifyFile() {
  if (!fileState.transmissionInfo || !fileState.isComplete) return
  
  try {
    const reconstructedData = reconstructFile()
    const actualChecksum = await calculateSHA256(reconstructedData)
    
    if (actualChecksum === fileState.transmissionInfo.checksum) {
      verificationStatus.value = {
        type: 'success',
        message: 'File received successfully and verified!'
      }
    } else {
      verificationStatus.value = {
        type: 'error',
        message: 'File verification failed - checksum mismatch'
      }
    }
  } catch (error) {
    verificationStatus.value = {
      type: 'error',
      message: 'File verification failed - reconstruction error'
    }
  }
}

function reconstructFile(): Uint8Array {
  if (!fileState.transmissionInfo) throw new Error('No transmission info')
  
  let base32Data = ''
  for (let i = 0; i < fileState.transmissionInfo.totalChunks; i++) {
    const chunkData = fileState.chunks.get(i)
    if (!chunkData) throw new Error(`Missing chunk ${i}`)
    base32Data += chunkData
  }
  
  return decodeBase32(base32Data)
}

function downloadFile() {
  if (!fileState.isComplete || !fileState.transmissionInfo) return
  
  try {
    const fileData = reconstructFile()
    // Create a proper ArrayBuffer for the Blob
    const buffer = new ArrayBuffer(fileData.length)
    const view = new Uint8Array(buffer)
    view.set(fileData)
    const blob = new Blob([buffer])
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = fileState.transmissionInfo.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Download failed:', error)
    alert('Failed to download file')
  }
}

function nextBatch() {
  if (fileState.currentBatch) {
    fileState.currentBatch = {
      ...fileState.currentBatch,
      batchNumber: fileState.currentBatch.batchNumber + 1
    }
    updateMissingChunks()
  }
}

function resetReceiver() {
  Object.assign(fileState, {
    transmissionInfo: undefined,
    chunks: new Map(),
    currentBatch: undefined,
    receivedChunks: new Set(),
    missingChunks: new Set(),
    isComplete: false
  })
  verificationStatus.value = null
  isReceiving.value = false
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.qr-receiver {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.receiver-header {
  text-align: center;
  margin-bottom: 24px;
}

.receiver-header h2 {
  margin: 0 0 16px 0;
  color: #333;
}

.start-btn {
  padding: 12px 24px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.start-btn:hover {
  background: #0056b3;
}

.receiver-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.transmission-info,
.batch-info,
.overall-progress,
.missing-chunks {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
}

.transmission-info h3,
.batch-info h4,
.overall-progress h4,
.missing-chunks h4 {
  margin: 0 0 12px 0;
  color: #333;
}

.file-stats p,
.batch-info p,
.progress-stats p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.batch-progress,
.progress-stats {
  margin-top: 12px;
}

.batch-progress-bar,
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.batch-progress-fill,
.progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.progress-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-stats span {
  align-self: flex-end;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.missing-list {
  font-family: monospace;
  font-size: 12px;
  color: #666;
  background: #e9ecef;
  padding: 8px;
  border-radius: 4px;
  line-height: 1.4;
}

.receiver-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.batch-btn,
.reset-btn,
.download-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.batch-btn {
  background: #007bff;
  color: white;
}

.batch-btn:hover:not(:disabled) {
  background: #0056b3;
}

.batch-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.reset-btn {
  background: #6c757d;
  color: white;
}

.reset-btn:hover {
  background: #545b62;
}

.download-btn {
  background: #28a745;
  color: white;
}

.download-btn:hover:not(:disabled) {
  background: #218838;
}

.download-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.verification-status {
  padding: 12px;
  border-radius: 6px;
  text-align: center;
}

.verification-status.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.verification-status.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.verification-status p {
  margin: 0;
  font-weight: 500;
}

@media (max-width: 600px) {
  .file-stats,
  .progress-stats {
    text-align: center;
  }
  
  .receiver-controls {
    flex-direction: column;
    align-items: center;
  }
  
  .batch-btn,
  .reset-btn,
  .download-btn {
    width: 200px;
  }
}
</style>