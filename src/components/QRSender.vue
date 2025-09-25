<template>
  <div class="qr-sender">
    <div class="main-content">
      <!-- Controls on the left -->
      <div class="controls-panel">
        <!-- File info at the top of controls -->
        <div class="file-info-section">
          <h2 class="file-name">{{ transmissionInfo.filename }}</h2>
          <div class="batch-progress-info">
            <p>Batch {{ currentBatchIndex + 1 }} of {{ batches.length }}</p>
            <div class="progress-bar">
              <div 
                class="progress-fill" 
                :style="{ width: progressPercent + '%' }"
              ></div>
            </div>
            <span class="progress-text">{{ Math.round(progressPercent) }}% complete</span>
          </div>
        </div>

        <div class="controls">
          <div class="control-section">
            <h3 class="control-title">Playback Controls</h3>
            <div class="rotation-controls">
        <button 
          @click="toggleRotation"
          :class="{ active: isRotating }"
          class="rotation-btn"
        >
          {{ isRotating ? '⏸️ Pause Cycle' : '▶️ Start Cycle' }}
        </button>
        
        <button @click="previousQR" class="nav-btn">
          ← Previous
        </button>
        
        <button @click="nextQR" class="nav-btn">
          Next →
        </button>
        
        <button @click="restartFromBeginning" class="restart-btn">
          🔄 Restart from Beginning
        </button>
            </div>
          </div>

          <div class="control-section">
            <h3 class="control-title">Batch Navigation</h3>
            <div class="batch-controls">
              <button 
                @click="previousBatch" 
                :disabled="currentBatchIndex === 0"
                class="batch-btn"
              >
                ← Previous Batch
              </button>
              
              <button 
                @click="nextBatch" 
                :disabled="currentBatchIndex === batches.length - 1"
                class="batch-btn"
              >
                Next Batch →
              </button>
            </div>
          </div>

        <div class="control-section">
          <h3 class="control-title">Speed Control</h3>
          <div class="speed-control">
            <label>Speed (ms): </label>
            <input 
              type="range" 
              v-model.number="rotationSpeed"
              min="1000" 
              max="5000" 
              step="500"
              @input="updateRotationSpeed"
            />
            <span>{{ rotationSpeed }}</span>
          </div>
        </div>
        </div>
        
        <div class="qr-info-panel">
          <div class="qr-info">
            <p>QR {{ currentQRIndex + 1 }} of {{ currentBatchQRs.length }}</p>
            <p class="qr-type">{{ getQRTypeDescription() }}</p>
            <p v-if="isRotating" class="cycle-status">🔄 Cycling {{ getCycleStatus() }}</p>
          </div>
          
          <div class="debug-info">
            <strong>Debug - Raw QR Data:</strong><br>
            {{ getCurrentQRData() }}
          </div>
        </div>
      </div>

      <!-- QR display on the right -->
      <div class="qr-display">
        <div class="qr-container">
          <img 
            v-if="currentQR" 
            :src="currentQR" 
            alt="QR Code"
            class="qr-image"
          />
          <div v-else class="qr-placeholder">
            Generating QR codes...
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { FileProcessor } from '../utils/file-processor'

const props = defineProps<{
  transmissionInfo: any
  batches: any[]
  config: any
}>()

const currentBatchIndex = ref(0)
const currentQRIndex = ref(0)
const currentBatchQRs = ref<string[]>([])
const isRotating = ref(false)
const rotationSpeed = ref(props.config.rotationSpeed)
const rotationInterval = ref<NodeJS.Timeout | null>(null)
const hasShownTransmissionInfo = ref(false)
const hasShownCurrentBatchInfo = ref(false)

const currentBatch = computed(() => props.batches[currentBatchIndex.value])
const currentQR = computed(() => {
  const qr = currentBatchQRs.value[currentQRIndex.value]
  console.log('=== QRSender currentQR DEBUG ===')
  console.log('Current QR index:', currentQRIndex.value)
  console.log('QR data URL length:', qr?.length || 0)
  console.log('QR data URL preview:', qr?.slice(0, 100) || 'null')
  console.log('=== END QRSender DEBUG ===')
  return qr
})
const progressPercent = computed(() => 
  ((currentBatchIndex.value + 1) / props.batches.length) * 100
)

onMounted(async () => {
  await loadCurrentBatch()
})

onUnmounted(() => {
  stopRotation()
})

async function loadCurrentBatch() {
  try {
    const processor = new FileProcessor(props.config)
    const qrCodes = await processor.generateQRCodes(
      props.transmissionInfo, 
      currentBatch.value
    )
    currentBatchQRs.value = qrCodes
    currentQRIndex.value = 0
  } catch (error) {
    console.error('Failed to load batch:', error)
  }
}

function getQRTypeDescription(): string {
  if (currentQRIndex.value === 0 && currentBatchIndex.value === 0) {
    return 'Transmission Info'
  }
  if (currentQRIndex.value === (currentBatchIndex.value === 0 ? 1 : 0)) {
    return 'Batch Info'
  }
  return 'Data Chunk'
}

function getCycleStatus(): string {
  const type = getQRTypeDescription()
  if (type === 'Data Chunk') {
    return 'data chunks'
  }
  return type.toLowerCase()
}

function getCurrentQRData(): string {
  const qrUrl = currentQR.value
  if (!qrUrl) return 'No QR data'
  
  // For debugging, we need to get the raw QR string data
  // This is tricky since we only have the data URL
  // Let's return some info about the current state instead
  const batch = props.batches[currentBatchIndex.value]
  const qrIndex = currentQRIndex.value
  
  if (qrIndex === 0 && currentBatchIndex.value === 0) {
    return `T${btoa(props.transmissionInfo.filename)}|${props.transmissionInfo.totalChunks}|${props.transmissionInfo.checksum}|${props.transmissionInfo.fileSize}`
  }
  
  const batchStartIndex = currentBatchIndex.value === 0 ? 1 : 0
  if (qrIndex === batchStartIndex) {
    const start = batch.batchInfo.startChunk.toString(36).toUpperCase()
    const end = batch.batchInfo.endChunk.toString(36).toUpperCase()  
    const total = batch.batchInfo.totalBatches.toString(36).toUpperCase()
    const current = batch.batchInfo.batchNumber.toString(36).toUpperCase()
    return `B${start}|${end}|${total}|${current}`
  }
  
  // Data chunk
  const chunkIndex = qrIndex - (currentBatchIndex.value === 0 ? 2 : 1)
  const chunk = batch.chunks[chunkIndex]
  if (chunk) {
    const chunkId = chunk.chunkId.toString(36).toUpperCase()
    return `D${chunkId}|${chunk.data.slice(0, 50)}...`
  }
  
  return 'Unknown QR type'
}

function toggleRotation() {
  if (isRotating.value) {
    stopRotation()
  } else {
    startRotation()
  }
}

function startRotation() {
  isRotating.value = true
  console.log('Starting QR cycling, speed:', rotationSpeed.value)
  
  rotationInterval.value = setInterval(() => {
    console.log(`Current QR: ${currentQRIndex.value} (batch ${currentBatchIndex.value})`)
    
    // Handle first batch - show transmission info once, then cycle data
    if (currentBatchIndex.value === 0) {
      if (!hasShownTransmissionInfo.value) {
        // Show transmission info (index 0)
        hasShownTransmissionInfo.value = true
        currentQRIndex.value = 0
        console.log('Showing transmission info')
        return
      }
      
      if (!hasShownCurrentBatchInfo.value) {
        // Show batch info (index 1)
        hasShownCurrentBatchInfo.value = true
        currentQRIndex.value = 1
        console.log('Showing batch info')
        return
      }
      
      // Cycle through data chunks (index 2+)
      if (currentQRIndex.value < 2) {
        currentQRIndex.value = 2 // Start with first data chunk
      } else if (currentQRIndex.value < currentBatchQRs.value.length - 1) {
        currentQRIndex.value++
      } else {
        currentQRIndex.value = 2 // Loop back to first data chunk
      }
      console.log(`Cycling data chunk: ${currentQRIndex.value}`)
    } else {
      // Handle subsequent batches - show batch info once, then cycle data
      if (!hasShownCurrentBatchInfo.value) {
        // Show batch info (index 0)
        hasShownCurrentBatchInfo.value = true
        currentQRIndex.value = 0
        console.log('Showing batch info for batch', currentBatchIndex.value)
        return
      }
      
      // Cycle through data chunks (index 1+)
      if (currentQRIndex.value < 1) {
        currentQRIndex.value = 1 // Start with first data chunk
      } else if (currentQRIndex.value < currentBatchQRs.value.length - 1) {
        currentQRIndex.value++
      } else {
        currentQRIndex.value = 1 // Loop back to first data chunk
      }
      console.log(`Cycling data chunk: ${currentQRIndex.value}`)
    }
  }, rotationSpeed.value)
}

function stopRotation() {
  isRotating.value = false
  if (rotationInterval.value) {
    clearInterval(rotationInterval.value)
    rotationInterval.value = null
  }
}

function updateRotationSpeed() {
  if (isRotating.value) {
    stopRotation()
    startRotation()
  }
}

function previousQR() {
  if (currentQRIndex.value > 0) {
    currentQRIndex.value--
  } else {
    // Wrap around to the last QR
    currentQRIndex.value = currentBatchQRs.value.length - 1
  }
}

function nextQR() {
  if (currentQRIndex.value < currentBatchQRs.value.length - 1) {
    currentQRIndex.value++
  } else {
    // Wrap around to the first QR
    currentQRIndex.value = 0
  }
}

async function previousBatch() {
  if (currentBatchIndex.value > 0) {
    stopRotation()
    currentBatchIndex.value--
    hasShownCurrentBatchInfo.value = false
    await loadCurrentBatch()
  }
}

async function nextBatch() {
  if (currentBatchIndex.value < props.batches.length - 1) {
    stopRotation()
    currentBatchIndex.value++
    hasShownCurrentBatchInfo.value = false
    await loadCurrentBatch()
  }
}

async function restartFromBeginning() {
  stopRotation()
  hasShownTransmissionInfo.value = false
  hasShownCurrentBatchInfo.value = false
  currentBatchIndex.value = 0
  currentQRIndex.value = 0
  await loadCurrentBatch()
  console.log('Restarted transmission from beginning')
}
</script>

<style scoped>
.qr-sender {
  width: 100%;
  height: 100vh;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.file-info-section {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.file-name {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
  word-break: break-word;
}

.batch-progress-info p {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

.main-content {
  display: flex;
  flex: 1;
  gap: 0;
  min-height: 0;
  height: 100vh;
}

.controls-panel {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(248, 249, 250, 0.98);
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
}

.qr-display {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 5px;
  background: #f5f5f5;
}

.qr-container {
  width: 100%;
  height: 100%;
  max-width: calc(100vh - 10px);
  max-height: calc(100vh - 10px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0;
  background: white;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.qr-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qr-placeholder {
  color: #999;
  font-style: italic;
}

.qr-info-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.qr-info {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
}

.qr-info p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.debug-info {
  background: #f0f0f0;
  padding: 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 11px;
  word-break: break-all;
  border: 1px solid #ddd;
  max-height: 200px;
  overflow-y: auto;
}

.qr-type {
  font-weight: 500;
  color: #007bff !important;
}

.cycle-status {
  font-size: 12px !important;
  color: #28a745 !important;
  font-style: italic;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.control-section {
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 16px;
}

.control-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 8px;
}

.rotation-controls,
.batch-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rotation-btn.active {
  background: #28a745;
}

.rotation-btn.active:hover {
  background: #218838;
}

.nav-btn,
.batch-btn,
.rotation-btn,
.restart-btn {
  padding: 12px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.2s;
  width: 100%;
}

.restart-btn {
  background: #ffc107;
  color: #212529;
}

.restart-btn:hover {
  background: #e0a800;
}

.nav-btn:hover:not(:disabled),
.batch-btn:hover:not(:disabled),
.rotation-btn:hover:not(.active) {
  background: #0056b3;
}

.nav-btn:disabled,
.batch-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.speed-control {
  /* Styling now handled by .control-section */
}

.speed-control label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.speed-control input[type="range"] {
  width: 100%;
  margin-bottom: 8px;
}

.speed-control span {
  display: block;
  text-align: center;
  font-weight: 500;
  color: #333;
}

@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }
  
  .controls-panel {
    width: 100%;
    order: 2;
    padding: 16px;
    background: rgba(248, 249, 250, 0.98);
    border-right: none;
    border-top: 1px solid #e0e0e0;
    max-height: 40vh;
  }
  
  .file-info-section {
    margin-bottom: 16px;
  }
  
  .file-name {
    font-size: 16px;
  }
  
  .qr-display {
    order: 1;
    flex: 1;
    padding: 5px;
  }
  
  .qr-container {
    max-width: calc(60vh - 10px);
    max-height: calc(60vh - 10px);
  }
  
  .rotation-controls,
  .batch-controls {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
  }
  
  .nav-btn,
  .batch-btn,
  .rotation-btn,
  .restart-btn {
    width: auto;
    min-width: 120px;
  }
}

@media (max-width: 600px) {
  .qr-display {
    padding: 3px;
  }
  
  .qr-container {
    max-width: calc(50vh - 6px);
    max-height: calc(50vh - 6px);
  }
  
  .controls-panel {
    padding: 12px;
    gap: 8px;
  }
  
  .file-info-section {
    padding: 12px;
    margin-bottom: 12px;
  }
  
  .file-name {
    font-size: 14px;
    margin-bottom: 8px;
  }
  
  .rotation-controls,
  .batch-controls {
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  
  .nav-btn,
  .batch-btn,
  .rotation-btn,
  .restart-btn {
    width: 180px;
    padding: 10px 14px;
    font-size: 13px;
  }
}
</style>