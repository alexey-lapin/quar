<template>
  <div class="qr-sender">
    <div class="sender-header">
      <h2>Sending: {{ transmissionInfo.filename }}</h2>
      <div class="progress-info">
        <p>Batch {{ currentBatchIndex + 1 }} of {{ batches.length }}</p>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: progressPercent + '%' }"
          ></div>
        </div>
      </div>
    </div>

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
      
      <div class="qr-info">
        <p>QR {{ currentQRIndex + 1 }} of {{ currentBatchQRs.length }}</p>
        <p class="qr-type">{{ getQRTypeDescription() }}</p>
      </div>
      
      <div class="debug-info" style="background: #f0f0f0; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 12px; word-break: break-all;">
        <strong>Debug - Raw QR Data:</strong><br>
        {{ getCurrentQRData() }}
      </div>
    </div>

    <div class="controls">
      <div class="rotation-controls">
        <button 
          @click="toggleRotation"
          :class="{ active: isRotating }"
          class="rotation-btn"
        >
          {{ isRotating ? 'Pause' : 'Play' }}
        </button>
        
        <button @click="previousQR" :disabled="currentQRIndex === 0" class="nav-btn">
          ← Previous
        </button>
        
        <button @click="nextQR" :disabled="currentQRIndex === currentBatchQRs.length - 1" class="nav-btn">
          Next →
        </button>
      </div>

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
  console.log('Starting QR rotation, speed:', rotationSpeed.value)
  rotationInterval.value = setInterval(() => {
    console.log(`Rotating QR: ${currentQRIndex.value} -> ${currentQRIndex.value + 1}`)
    if (currentQRIndex.value < currentBatchQRs.value.length - 1) {
      currentQRIndex.value++
    } else {
      console.log('Rotation complete, stopping')
      stopRotation()
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
  }
}

function nextQR() {
  if (currentQRIndex.value < currentBatchQRs.value.length - 1) {
    currentQRIndex.value++
  }
}

async function previousBatch() {
  if (currentBatchIndex.value > 0) {
    stopRotation()
    currentBatchIndex.value--
    await loadCurrentBatch()
  }
}

async function nextBatch() {
  if (currentBatchIndex.value < props.batches.length - 1) {
    stopRotation()
    currentBatchIndex.value++
    await loadCurrentBatch()
  }
}
</script>

<style scoped>
.qr-sender {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.sender-header {
  text-align: center;
  margin-bottom: 24px;
}

.sender-header h2 {
  margin: 0 0 16px 0;
  color: #333;
}

.progress-info p {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s ease;
}

.qr-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32px;
}

.qr-container {
  width: 512px;
  height: 512px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  margin-bottom: 16px;
}

.qr-image {
  max-width: 100%;
  max-height: 100%;
}

.qr-placeholder {
  color: #999;
  font-style: italic;
}

.qr-info {
  text-align: center;
}

.qr-info p {
  margin: 4px 0;
  color: #666;
  font-size: 14px;
}

.qr-type {
  font-weight: 500;
  color: #007bff !important;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rotation-controls,
.batch-controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.rotation-btn.active {
  background: #28a745;
}

.rotation-btn.active:hover {
  background: #218838;
}

.nav-btn,
.batch-btn,
.rotation-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: #666;
}

.speed-control input[type="range"] {
  width: 200px;
}

.speed-control span {
  min-width: 50px;
  text-align: center;
  font-weight: 500;
  color: #333;
}

@media (max-width: 600px) {
  .qr-container {
    width: 300px;
    height: 300px;
  }
  
  .rotation-controls,
  .batch-controls {
    flex-direction: column;
    align-items: center;
  }
  
  .speed-control {
    flex-direction: column;
    gap: 4px;
  }
}
</style>