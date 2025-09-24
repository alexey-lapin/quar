<template>
  <div class="qr-scanner">
    <div class="scanner-header">
      <h2>QR Code Scanner</h2>
      <div v-if="!isScanning" class="start-section">
        <div class="permission-info">
          <p>📷 Camera access is required to scan QR codes</p>
          <p class="info-text">Click below to request camera permission</p>
        </div>
        <button @click="startScanning" class="start-btn">
          Start Scanning
        </button>
      </div>
    </div>

    <div v-if="isScanning" class="scanner-container">
      <video 
        ref="videoElement"
        class="scanner-video"
        autoplay
        muted
        playsinline
      ></video>
      
      <div class="scanner-controls">
        <button @click="stopScanning" class="stop-btn">
          Stop Scanning
        </button>
        <button @click="toggleCamera" class="camera-btn">
          Switch Camera
        </button>
        <button @click="clearScannedCodes" class="clear-btn">
          Clear Cache
        </button>
      </div>
    </div>

    <div v-if="scanResult" class="scan-result">
      <h3>Last Scanned:</h3>
      <div class="result-info">
        <p><strong>Type:</strong> {{ getResultTypeDescription(scanResult.type) }}</p>
        <p v-if="scanResult.type === 'D'"><strong>Chunk ID:</strong> {{ getChunkId(scanResult.data) }}</p>
        <p class="result-data">{{ truncateData(scanResult.rawData) }}</p>
      </div>
    </div>

    <div class="scan-status">
      <p>{{ statusMessage }}</p>
      <div v-if="duplicateCount > 0" class="duplicate-info">
        <p>Duplicates ignored: {{ duplicateCount }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { BrowserMultiFormatReader } from '@zxing/library'
import { parseQR } from '../utils/protocol'
import type { QRProtocol } from '../types'

const emit = defineEmits<{
  qrScanned: [result: QRProtocol & { rawData: string }]
}>()

const videoElement = ref<HTMLVideoElement>()
const isScanning = ref(false)
const scanResult = ref<(QRProtocol & { rawData: string }) | null>(null)
const statusMessage = ref('Ready to scan')
const duplicateCount = ref(0)
const scannedCodes = new Map<string, number>() // Store QR data -> timestamp

let codeReader: BrowserMultiFormatReader | null = null
let currentDeviceId: string | null = null
let availableDevices: MediaDeviceInfo[] = []

onMounted(() => {
  try {
    codeReader = new BrowserMultiFormatReader()
    
    statusMessage.value = 'Ready to scan'
  } catch (error) {
    console.error('Failed to initialize scanner:', error)
    statusMessage.value = 'Scanner initialization failed'
  }
})

onUnmounted(() => {
  stopScanning()
})

async function startScanning() {
  if (!codeReader) {
    statusMessage.value = 'Scanner not initialized'
    return
  }

  try {
    isScanning.value = true
    statusMessage.value = 'Requesting camera access...'
    
    // First, get available devices (this will trigger permission request)
    availableDevices = await codeReader.listVideoInputDevices()
    console.log('Available cameras:', availableDevices.length)
    
    if (availableDevices.length === 0) {
      statusMessage.value = 'No camera found on this device'
      isScanning.value = false
      return
    }
    
    statusMessage.value = 'Starting camera...'
    currentDeviceId = availableDevices[0].deviceId
    
    await codeReader.decodeFromVideoDevice(
      currentDeviceId,
      videoElement.value!,
      (result, error) => {
        if (result) {
          handleScanResult(result.getText())
        }
        if (error && !error.message.includes('No QR code found')) {
          console.error('Scan error:', error)
        }
      }
    )
    
    statusMessage.value = 'Scanning... Point camera at QR code'
  } catch (error) {
    console.error('Failed to start scanning:', error)
    
    // More specific error messages
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
      statusMessage.value = 'Camera access denied. Please allow camera permission and try again.'
    } else if (errorMessage.includes('NotFoundError')) {
      statusMessage.value = 'No camera found on this device'
    } else if (errorMessage.includes('NotReadableError')) {
      statusMessage.value = 'Camera is in use by another application'
    } else {
      statusMessage.value = `Camera error: ${errorMessage}`
    }
    
    isScanning.value = false
  }
}

function stopScanning() {
  if (codeReader) {
    codeReader.reset()
  }
  isScanning.value = false
  statusMessage.value = 'Scanning stopped'
}

function clearScannedCodes() {
  scannedCodes.clear()
  duplicateCount.value = 0
  console.log('Cleared scanned codes cache')
}

async function toggleCamera() {
  if (!codeReader || availableDevices.length <= 1) return
  
  const currentIndex = availableDevices.findIndex(d => d.deviceId === currentDeviceId)
  const nextIndex = (currentIndex + 1) % availableDevices.length
  
  stopScanning()
  currentDeviceId = availableDevices[nextIndex].deviceId
  
  setTimeout(() => {
    startScanning()
  }, 100)
}

function handleScanResult(rawData: string) {
  const now = Date.now()
  console.log('=== QR SCAN DEBUG ===')
  console.log('Timestamp:', now)
  console.log('Raw scanned data:', rawData)
  console.log('Length:', rawData.length)
  console.log('First 50 chars:', rawData.slice(0, 50))
  
  // Check if we've seen this exact raw data before
  const lastScanTime = scannedCodes.get(rawData)
  if (lastScanTime) {
    const timeSinceLastScan = now - lastScanTime
    console.log(`DUPLICATE: Already scanned ${timeSinceLastScan}ms ago`)
    
    // Allow re-scanning after 5 seconds (for debugging purposes)
    if (timeSinceLastScan < 5000) {
      duplicateCount.value++
      return
    } else {
      console.log('RESCAN: Allowing rescan after timeout')
    }
  }
  
  scannedCodes.set(rawData, now)
  
  const parsed = parseQR(rawData)
  console.log('Parsed result:', JSON.stringify(parsed, null, 2))
  
  if (!parsed) {
    console.log('INVALID: Failed to parse QR code')
    statusMessage.value = `Invalid QR code format: ${rawData.slice(0, 20)}...`
    return
  }
  
  console.log('SUCCESS: Valid QR code parsed, type:', parsed.type)
  const result = { ...parsed, rawData }
  scanResult.value = result
  statusMessage.value = `Scanned ${getResultTypeDescription(parsed.type)}`
  
  emit('qrScanned', result)
  console.log('=== END QR SCAN DEBUG ===')
}

function getResultTypeDescription(type: string): string {
  switch (type) {
    case 'T': return 'Transmission Info'
    case 'D': return 'Data Chunk'
    case 'B': return 'Batch Info'
    default: return 'Unknown'
  }
}

function getChunkId(data: string): string {
  const pipeIndex = data.indexOf('|')
  if (pipeIndex === -1) return 'Unknown'
  return parseInt(data.slice(0, pipeIndex), 36).toString()
}

function truncateData(data: string, maxLength = 50): string {
  return data.length > maxLength ? data.slice(0, maxLength) + '...' : data
}
</script>

<style scoped>
.qr-scanner {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.scanner-header {
  text-align: center;
  margin-bottom: 24px;
}

.scanner-header h2 {
  margin: 0 0 16px 0;
  color: #333;
}

.start-section {
  margin-top: 16px;
}

.permission-info {
  margin-bottom: 16px;
  text-align: center;
}

.permission-info p {
  margin: 4px 0;
  color: #666;
}

.info-text {
  font-size: 14px;
  color: #999 !important;
}

.start-btn {
  padding: 12px 24px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.start-btn:hover {
  background: #218838;
}

.scanner-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.scanner-video {
  width: 100%;
  max-width: 500px;
  height: auto;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #000;
}

.scanner-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.stop-btn,
.camera-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.stop-btn {
  background: #dc3545;
  color: white;
}

.stop-btn:hover {
  background: #c82333;
}

.camera-btn {
  background: #007bff;
  color: white;
}

.camera-btn:hover {
  background: #0056b3;
}

.scan-result {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.scan-result h3 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 16px;
}

.result-info p {
  margin: 4px 0;
  font-size: 14px;
  color: #666;
}

.result-info strong {
  color: #333;
}

.result-data {
  font-family: monospace;
  background: #e9ecef;
  padding: 8px;
  border-radius: 4px;
  word-break: break-all;
  margin-top: 8px !important;
}

.scan-status {
  text-align: center;
  padding: 16px;
  background: #e9ecef;
  border-radius: 8px;
}

.scan-status p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.duplicate-info {
  margin-top: 8px;
  font-size: 12px;
  color: #999;
}

.duplicate-info p {
  margin: 0;
}

@media (max-width: 600px) {
  .scanner-controls {
    flex-direction: column;
    align-items: center;
  }
  
  .stop-btn,
  .camera-btn {
    width: 200px;
  }
}
</style>