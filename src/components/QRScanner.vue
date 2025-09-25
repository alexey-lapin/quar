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

    <!-- Always show camera area to prevent layout jumps -->
    <div v-if="isScanning || hasStartedOnce" class="scanner-container">
      <div class="video-container">
        <video 
          ref="videoElement"
          class="scanner-video"
          autoplay
          muted
          playsinline
          :style="{ visibility: isScanning ? 'visible' : 'hidden' }"
        ></video>
        <div v-if="!isScanning && hasStartedOnce" class="camera-placeholder">
          <div class="placeholder-content">
            <p>📷</p>
            <p class="placeholder-text">{{ statusMessage }}</p>
          </div>
        </div>
      </div>
      
      <div class="camera-info" v-if="currentCameraLabel && isScanning">
        <p class="current-camera">📷 {{ currentCameraLabel }}</p>
      </div>
      
      <div v-if="isScanning" class="scanner-controls">
        <button @click="stopScanning" class="stop-btn">
          Stop Scanning
        </button>
        <button @click="toggleCamera" class="camera-btn" :disabled="availableDevices.length <= 1">
          Switch Camera ({{ availableDevices.length }})
        </button>
        <button @click="clearScannedCodes" class="clear-btn">
          Clear Cache
        </button>
        <button @click="forceRescan" class="rescan-btn">
          Force Rescan
        </button>
        <button @click="restartScanner" class="restart-btn">
          Restart Scanner
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
      <div v-if="failedScanCount > 0" class="failed-info">
        <p>Parse failures: {{ failedScanCount }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { BrowserMultiFormatReader } from '@zxing/library'
import { parseQR } from '../utils/protocol'
import type { QRProtocol } from '../types'

const emit = defineEmits<{
  qrScanned: [result: QRProtocol & { rawData: string }]
}>()

const videoElement = ref<HTMLVideoElement>()
const isScanning = ref(false)
const hasStartedOnce = ref(false)
const scanResult = ref<(QRProtocol & { rawData: string }) | null>(null)
const statusMessage = ref('Ready to scan')
const duplicateCount = ref(0)
const failedScanCount = ref(0)
const scannedCodes = new Map<string, number>() // Store QR data -> timestamp

let codeReader: BrowserMultiFormatReader | null = null
let currentDeviceId: string | null = null
let preferredDeviceId: string | null = null // Store the user's preferred camera
const availableDevices = ref<MediaDeviceInfo[]>([])

const currentCameraLabel = computed(() => {
  if (!currentDeviceId || availableDevices.value.length === 0) return null
  const device = availableDevices.value.find(d => d.deviceId === currentDeviceId)
  return device?.label || 'Unknown Camera'
})

function initializeScanner() {
  try {
    console.log('Initializing QR scanner...')
    
    // Dispose of old reader if it exists
    if (codeReader) {
      console.log('Disposing old reader')
      codeReader.reset()
    }
    
    codeReader = new BrowserMultiFormatReader()
    console.log('QR scanner initialized successfully')
    statusMessage.value = 'Ready to scan'
    return true
  } catch (error) {
    console.error('Failed to initialize scanner:', error)
    statusMessage.value = 'Scanner initialization failed'
    return false
  }
}

onMounted(() => {
  initializeScanner()
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
    hasStartedOnce.value = true
    statusMessage.value = 'Requesting camera access...'
    
    // First, get available devices (this will trigger permission request)
    availableDevices.value = await codeReader.listVideoInputDevices()
    console.log('Available cameras:', availableDevices.value.length)
    
    if (availableDevices.value.length === 0) {
      statusMessage.value = 'No camera found on this device'
      isScanning.value = false
      return
    }
    
    statusMessage.value = 'Starting camera...'
    
    // Use preferred device if available, otherwise fall back to the first device
    let targetDeviceId = availableDevices.value[0].deviceId
    
    if (preferredDeviceId) {
      const preferredDevice = availableDevices.value.find(d => d.deviceId === preferredDeviceId)
      if (preferredDevice) {
        targetDeviceId = preferredDeviceId
        console.log('Using preferred camera:', preferredDevice.label || 'Unknown camera')
      } else {
        console.log('Preferred camera not found, using default')
        // If preferred device is no longer available, try to find the back camera
        const backCamera = availableDevices.value.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
        )
        if (backCamera) {
          targetDeviceId = backCamera.deviceId
          console.log('Using back camera as fallback:', backCamera.label)
        }
      }
    } else {
      // First time - try to select back camera if available
      const backCamera = availableDevices.value.find(d => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear') ||
        d.label.toLowerCase().includes('environment')
      )
      if (backCamera) {
        targetDeviceId = backCamera.deviceId
        preferredDeviceId = targetDeviceId
        console.log('Auto-selected back camera:', backCamera.label)
      }
    }
    
    currentDeviceId = targetDeviceId
    
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
  // Keep hasStartedOnce as true to maintain layout
}

function clearScannedCodes() {
  scannedCodes.clear()
  duplicateCount.value = 0
  console.log('Cleared scanned codes cache')
}

function forceRescan() {
  // Clear the last 3 scanned codes to allow immediate rescanning
  const entries = Array.from(scannedCodes.entries())
  const recentEntries = entries
    .sort(([,a], [,b]) => b - a) // Sort by timestamp, newest first
    .slice(0, 3) // Take the 3 most recent
  
  recentEntries.forEach(([qrData]) => {
    scannedCodes.delete(qrData)
    console.log('Removed from cache for rescan:', qrData.slice(0, 20))
  })
  
  console.log('Force rescan: cleared recent scanned codes')
}

function restartScanner() {
  console.log('=== RESTARTING SCANNER ===')
  console.log('Current preferred camera:', preferredDeviceId)
  
  // Stop current scanning
  if (codeReader) {
    codeReader.reset()
  }
  isScanning.value = false
  
  // Reset failure count and status
  failedScanCount.value = 0
  statusMessage.value = 'Restarting scanner...'
  
  // Reinitialize the entire scanner
  const initialized = initializeScanner()
  if (!initialized) {
    console.error('Failed to reinitialize scanner')
    return
  }
  
  // Wait a moment then restart - startScanning() will use preferredDeviceId
  setTimeout(async () => {
    try {
      await startScanning()
      console.log('Scanner restarted successfully with preferred camera')
    } catch (error) {
      console.error('Failed to restart scanner:', error)
      statusMessage.value = 'Failed to restart scanner'
    }
  }, 500)
}

// Auto-clear old scanned codes every 30 seconds to prevent getting permanently stuck
setInterval(() => {
  const now = Date.now()
  const oldEntries = []
  
  for (const [qrData, timestamp] of scannedCodes.entries()) {
    if (now - timestamp > 30000) { // 30 seconds
      oldEntries.push(qrData)
    }
  }
  
  if (oldEntries.length > 0) {
    oldEntries.forEach(qrData => scannedCodes.delete(qrData))
    console.log(`Auto-cleared ${oldEntries.length} old scanned codes`)
  }
}, 10000) // Check every 10 seconds

async function toggleCamera() {
  if (!codeReader || availableDevices.value.length <= 1) {
    console.log('Cannot toggle camera - only one device available')
    return
  }
  
  console.log('Toggling camera...')
  const currentIndex = availableDevices.value.findIndex(d => d.deviceId === currentDeviceId)
  const nextIndex = (currentIndex + 1) % availableDevices.value.length
  const nextDevice = availableDevices.value[nextIndex]
  
  console.log(`Switching from camera ${currentIndex} to camera ${nextIndex}`)
  console.log(`Next camera: ${nextDevice.label || 'Unknown'}`)
  
  // Save the new preferred device BEFORE stopping
  preferredDeviceId = nextDevice.deviceId
  currentDeviceId = nextDevice.deviceId
  
  // Stop and restart with the new preferred camera
  stopScanning()
  
  setTimeout(async () => {
    try {
      await startScanning()
      console.log('Camera toggle completed successfully')
    } catch (error) {
      console.error('Failed to restart with new camera:', error)
      statusMessage.value = 'Failed to switch camera'
    }
  }, 100)
}

function handleScanResult(rawData: string) {
  const now = Date.now()
  console.log('=== QR SCAN DEBUG ===')
  console.log('Timestamp:', now)
  console.log('Raw scanned data type:', typeof rawData)
  console.log('Raw scanned data:', rawData)
  console.log('Length:', rawData?.length || 'undefined')
  console.log('First 50 chars:', rawData?.slice(0, 50) || 'N/A')
  
  // Validate basic data integrity
  if (typeof rawData !== 'string') {
    console.log('ERROR: rawData is not a string!')
    statusMessage.value = 'Invalid scan result (not string)'
    return
  }
  
  if (rawData.length === 0) {
    console.log('ERROR: rawData is empty string!')
    statusMessage.value = 'Invalid scan result (empty)'
    return
  }
  
  // Check if we've seen this exact raw data before
  const lastScanTime = scannedCodes.get(rawData)
  if (lastScanTime) {
    const timeSinceLastScan = now - lastScanTime
    console.log(`DUPLICATE: Already scanned ${timeSinceLastScan}ms ago`)
    
    // For data QRs, allow re-scanning after 3 seconds (shorter timeout)
    // For other QRs, use 5 seconds
    const timeoutMs = rawData.startsWith('D') ? 3000 : 5000
    
    if (timeSinceLastScan < timeoutMs) {
      duplicateCount.value++
      return
    } else {
      console.log(`RESCAN: Allowing rescan after ${timeoutMs}ms timeout`)
    }
  }
  
  let parsed = parseQR(rawData)
  console.log('Parsed result:', JSON.stringify(parsed, null, 2))
  
  // If parsing failed, try some basic cleanup
  if (!parsed && rawData.length > 0) {
    console.log('RETRY: Attempting to clean and re-parse QR data')
    
    // Try trimming whitespace
    const trimmed = rawData.trim()
    if (trimmed !== rawData) {
      console.log('Trying trimmed version:', trimmed.slice(0, 50))
      parsed = parseQR(trimmed)
    }
    
    // Try removing null bytes or other control characters
    if (!parsed) {
      const cleaned = rawData.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      if (cleaned !== rawData && cleaned.length > 0) {
        console.log('Trying cleaned version:', cleaned.slice(0, 50))
        parsed = parseQR(cleaned)
      }
    }
  }
  
  if (!parsed) {
    console.log('INVALID: Failed to parse QR code after cleanup attempts')
    statusMessage.value = `Invalid QR code format: ${rawData.slice(0, 20)}...`
    
    // Add a recovery mechanism - restart scanner after a few failed attempts
    failedScanCount.value++
    console.log(`Failed scan count: ${failedScanCount.value}`)
    
    if (failedScanCount.value >= 3) {
      console.log('Too many failed scans, restarting scanner...')
      setTimeout(() => {
        restartScanner()
      }, 1000)
    }
    
    return
  }
  
  // Reset failed count on successful scan
  failedScanCount.value = 0
  
  // Only add successfully parsed QR codes to prevent getting stuck on invalid ones
  scannedCodes.set(rawData, now)
  
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

.video-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  aspect-ratio: 4/3; /* Reserve consistent space */
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #000;
  overflow: hidden;
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a1a;
  color: #ccc;
}

.placeholder-content {
  text-align: center;
}

.camera-placeholder p {
  margin: 0;
}

.camera-placeholder p:first-child {
  font-size: 48px;
  margin-bottom: 8px;
}

.placeholder-text {
  font-size: 14px;
  opacity: 0.8;
}

.camera-info {
  text-align: center;
  margin-bottom: 8px;
}

.current-camera {
  margin: 0;
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.scanner-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.stop-btn,
.camera-btn,
.clear-btn,
.rescan-btn,
.restart-btn {
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

.camera-btn:hover:not(:disabled) {
  background: #0056b3;
}

.camera-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.clear-btn {
  background: #ffc107;
  color: #212529;
}

.clear-btn:hover {
  background: #e0a800;
}

.rescan-btn {
  background: #17a2b8;
  color: white;
}

.rescan-btn:hover {
  background: #138496;
}

.restart-btn {
  background: #fd7e14;
  color: white;
}

.restart-btn:hover {
  background: #e8680b;
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
  .video-container {
    aspect-ratio: 3/4; /* Better mobile aspect ratio */
  }
  
  .scanner-controls {
    flex-direction: column;
    align-items: center;
  }
  
  .stop-btn,
  .camera-btn,
  .clear-btn,
  .rescan-btn,
  .restart-btn {
    width: 200px;
  }
}
</style>