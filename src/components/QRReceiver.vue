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
      <div class="camera-section">
        <div class="camera-wrapper">
          <QRScanner @qr-scanned="handleQRScanned" ref="qrScanner" :embedded="true" />
          
          <!-- Transparent scan info overlay over camera -->
          <div class="scan-info-overlay">
          <!-- Always show overlay status -->
          <div class="overlay-status">
            <p>📡 Scanning for QR codes...</p>
            <p v-if="!fileState.transmissionInfo">Ready to receive</p>
          </div>
          
          <div v-if="fileState.transmissionInfo" class="transmission-info">
            <h3>{{ fileState.transmissionInfo.filename }}</h3>
            <p>{{ formatFileSize(fileState.transmissionInfo.fileSize) }} | {{ fileState.transmissionInfo.totalChunks }} chunks</p>
          </div>

          <div v-if="fileState.currentBatch" class="batch-info">
            <p>Batch {{ fileState.currentBatch.batchNumber + 1 }}/{{ fileState.currentBatch.totalBatches }}</p>
            <div class="batch-progress">
              <div class="batch-progress-bar">
                <div 
                  class="batch-progress-fill" 
                  :style="{ width: batchProgressPercent + '%' }"
                ></div>
              </div>
              <span>{{ receivedInCurrentBatch }}/{{ currentBatchSize }}</span>
            </div>
          </div>

          <div v-if="fileState.transmissionInfo" class="overall-progress">
            <p>Progress: {{ fileState.receivedChunks.size }}/{{ fileState.transmissionInfo?.totalChunks || 0 }} ({{ Math.round(overallProgressPercent) }}%)</p>
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: overallProgressPercent + '%' }"
              ></div>
            </div>
          </div>

          <div v-if="fileState.missingChunks.size > 0" class="missing-chunks">
            <p>Missing: {{ fileState.missingChunks.size }} chunks</p>
            <div class="missing-list">{{ Array.from(fileState.missingChunks).sort((a, b) => a - b).join(', ') }}</div>
          </div>
          </div> <!-- End scan-info-overlay -->
        </div> <!-- End camera-wrapper -->
      </div> <!-- End camera-section -->
      
      <!-- Controls positioned under camera window -->
      <div class="controls-section">
        <div class="control-info" v-if="fileState.transmissionInfo">
          <div class="file-summary">
            <h3>{{ fileState.transmissionInfo.filename }}</h3>
            <p>{{ formatFileSize(fileState.transmissionInfo.fileSize) }} • {{ fileState.transmissionInfo.totalChunks }} chunks</p>
            <p>Progress: {{ fileState.receivedChunks.size }}/{{ fileState.transmissionInfo.totalChunks }} ({{ Math.round(overallProgressPercent) }}%)</p>
          </div>
          
          <div v-if="fileState.currentBatch" class="batch-summary">
            <p><strong>Current Batch:</strong> {{ fileState.currentBatch.batchNumber + 1 }}/{{ fileState.currentBatch.totalBatches }}</p>
            <p><strong>Batch Progress:</strong> {{ receivedInCurrentBatch }}/{{ currentBatchSize }} ({{ Math.round(batchProgressPercent) }}%)</p>
          </div>
          
          <div v-if="fileState.missingChunks.size > 0" class="missing-detail">
            <p><strong>Missing {{ fileState.missingChunks.size }} chunks:</strong></p>
            <div class="missing-ids">{{ Array.from(fileState.missingChunks).sort((a, b) => a - b).join(', ') }}</div>
          </div>
        </div>

        <div class="receiver-controls">
          <button @click="nextBatch" :disabled="!canNextBatch" class="batch-btn">
            <span>📦</span> Next Batch
          </button>
          <button @click="resetReceiver" class="reset-btn">
            <span>🔄</span> Reset Receiver
          </button>
          <button 
            @click="downloadFile" 
            :disabled="!fileState.isComplete"
            class="download-btn"
          >
            <span>💾</span> Download
          </button>
        </div>
        
        <div class="scanner-controls">
          <button @click="startScanning" v-if="!isScannerActive" class="start-scan-btn">
            <span>📷</span> Start Scanner
          </button>
          <button @click="stopScanning" v-if="isScannerActive" class="stop-scan-btn">
            <span>⏹️</span> Stop Scanner
          </button>
          <button @click="switchCamera" :disabled="!canSwitchCamera" class="switch-camera-btn">
            <span>🔄</span> Switch Camera
          </button>
          <button @click="restartScanner" class="restart-scanner-btn">
            <span>🔃</span> Restart Scanner
          </button>
        </div>

        <div v-if="verificationStatus" class="verification-status" :class="verificationStatus.type">
          <p>{{ verificationStatus.message }}</p>
        </div>
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
const qrScanner = ref<InstanceType<typeof QRScanner>>()
const isScannerActive = ref(false)
const canSwitchCamera = ref(false)

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
  // Auto-start scanning when receiving starts
  setTimeout(() => {
    startScanning()
  }, 100)
}

function startScanning() {
  if (qrScanner.value) {
    qrScanner.value.startScanning()
    isScannerActive.value = true
  }
}

function stopScanning() {
  if (qrScanner.value) {
    qrScanner.value.stopScanning()
    isScannerActive.value = false
  }
}

function switchCamera() {
  if (qrScanner.value) {
    qrScanner.value.toggleCamera()
  }
}

function restartScanner() {
  if (qrScanner.value) {
    qrScanner.value.restartScanner()
  }
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
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.receiver-header {
  text-align: center;
  margin: 0;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.95);
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.camera-section {
  position: relative;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.camera-wrapper {
  position: relative;
  width: 100%;
  max-width: 500px;
  max-height: 500px;
  aspect-ratio: 1/1;
  margin: 0 auto;
}

.scan-info-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 280px;
  max-height: calc(100% - 20px);
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 12px;
  color: white;
  overflow-y: auto;
  z-index: 20;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.controls-section {
  flex-shrink: 0;
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.95);
  border-top: 1px solid #e0e0e0;
}

.control-info {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.file-summary h3 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.file-summary p,
.batch-summary p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.batch-summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.missing-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.missing-detail p {
  margin: 0 0 8px 0;
  color: #dc3545;
  font-size: 14px;
  font-weight: 500;
}

.missing-ids {
  font-family: monospace;
  font-size: 12px;
  color: #dc3545;
  background: #fff5f5;
  padding: 8px;
  border-radius: 4px;
  max-height: 100px;
  overflow-y: auto;
  line-height: 1.4;
  word-break: break-all;
}

.overlay-status,
.transmission-info,
.batch-info,
.overall-progress,
.missing-chunks {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  margin-bottom: 12px;
}

.overlay-status p {
  margin: 3px 0;
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  font-style: italic;
}

.transmission-info h3 {
  margin: 0 0 6px 0;
  color: white;
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

.transmission-info p,
.batch-info p,
.overall-progress p,
.missing-chunks p {
  margin: 3px 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
}

.batch-progress,
.progress-stats {
  margin-top: 8px;
}

.batch-progress-bar,
.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
  margin: 3px 0;
}

.batch-progress-fill,
.progress-fill {
  height: 100%;
  background: #4CAF50;
  transition: width 0.3s ease;
  box-shadow: 0 0 4px rgba(76, 175, 80, 0.6);
}

.batch-progress span {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
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
  margin-bottom: 12px;
}

.scanner-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.batch-btn,
.reset-btn,
.download-btn,
.start-scan-btn,
.stop-scan-btn,
.switch-camera-btn,
.restart-scanner-btn {
  padding: 12px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.batch-btn span,
.reset-btn span,
.download-btn span,
.start-scan-btn span,
.stop-scan-btn span,
.switch-camera-btn span,
.restart-scanner-btn span {
  font-size: 16px;
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

.start-scan-btn {
  background: #28a745;
  color: white;
}

.start-scan-btn:hover {
  background: #218838;
}

.stop-scan-btn {
  background: #dc3545;
  color: white;
}

.stop-scan-btn:hover {
  background: #c82333;
}

.switch-camera-btn {
  background: #007bff;
  color: white;
}

.switch-camera-btn:hover:not(:disabled) {
  background: #0056b3;
}

.switch-camera-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.restart-scanner-btn {
  background: #fd7e14;
  color: white;
}

.restart-scanner-btn:hover {
  background: #e8680b;
}

.verification-status {
  padding: 10px;
  border-radius: 6px;
  text-align: center;
  margin-top: 12px;
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

@media (max-width: 768px) {
  .camera-wrapper {
    max-width: 90vw;
    max-height: 90vw;
  }
  
  .scan-info-overlay {
    position: absolute;
    bottom: 10px;
    left: 10px;
    right: 10px;
    top: auto;
    width: auto;
    max-height: 60vh;
  }
  
  .controls-section {
    padding: 12px 15px;
  }
  
  .control-info {
    padding: 12px;
  }
  
  .file-summary h3 {
    font-size: 15px;
  }
  
  .file-summary p,
  .batch-summary p {
    font-size: 13px;
  }
  
  .missing-detail p {
    font-size: 13px;
  }
  
  .receiver-controls {
    gap: 8px;
  }
  
  .batch-btn,
  .reset-btn,
  .download-btn,
  .start-scan-btn,
  .stop-scan-btn,
  .switch-camera-btn,
  .restart-scanner-btn {
    font-size: 12px;
    padding: 10px 12px;
    min-width: 100px;
  }
}

@media (max-width: 480px) {
  .camera-wrapper {
    max-width: 95vw;
    max-height: 95vw;
  }
  
  .scan-info-overlay {
    left: 5px;
    right: 5px;
    bottom: 5px;
    padding: 8px;
    max-height: 45vh;
  }
  
  .controls-section {
    padding: 10px;
  }
  
  .control-info {
    padding: 10px;
  }
  
  .file-summary h3 {
    font-size: 14px;
  }
  
  .file-summary p,
  .batch-summary p {
    font-size: 12px;
  }
  
  .missing-detail p {
    font-size: 12px;
  }
  
  .missing-ids {
    font-size: 11px;
    max-height: 80px;
  }
  
  .transmission-info h3 {
    font-size: 13px;
  }
  
  .transmission-info p,
  .batch-info p,
  .overall-progress p,
  .missing-chunks p {
    font-size: 11px;
  }
  
  .receiver-controls {
    gap: 6px;
    flex-direction: column;
  }
  
  .batch-btn,
  .reset-btn,
  .download-btn,
  .start-scan-btn,
  .stop-scan-btn,
  .switch-camera-btn,
  .restart-scanner-btn {
    min-width: 100%;
    font-size: 13px;
    padding: 12px;
  }
}
</style>