<template>
  <div class="file-uploader">
    <div 
      class="upload-area"
      :class="{ 'dragover': isDragOver }"
      @drop="handleDrop"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
      @click="triggerFileInput"
    >
      <input 
        ref="fileInput"
        type="file"
        @change="handleFileSelect"
        style="display: none"
      />
      
      <div v-if="!file" class="upload-prompt">
        <div class="upload-icon">📁</div>
        <p>Drop a file here or click to select</p>
        <p class="upload-hint">Any file type supported</p>
      </div>
      
      <div v-else class="file-info">
        <div class="file-icon">📄</div>
        <div class="file-details">
          <h3>{{ file.name }}</h3>
          <p>{{ formatFileSize(file.size) }}</p>
          <button @click.stop="clearFile" class="clear-btn">×</button>
        </div>
      </div>
    </div>
    
    <div v-if="file" class="config-section">
      <h3>Transfer Configuration</h3>
      <div class="config-grid">
        <div class="config-item">
          <label>Batch Size:</label>
          <input 
            type="number" 
            v-model.number="config.batchSize"
            min="5"
            max="20"
          />
        </div>
        <div class="config-item">
          <label>Rotation Speed (ms):</label>
          <input 
            type="number" 
            v-model.number="config.rotationSpeed"
            min="1000"
            max="5000"
            step="500"
          />
        </div>
      </div>
      
      <button 
        @click="startTransfer" 
        class="start-btn"
        :disabled="isProcessing"
      >
        {{ isProcessing ? 'Processing...' : 'Start Transfer' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { QRSenderConfig } from '../types'
import { FileProcessor } from '../utils/file-processor'

const emit = defineEmits<{
  fileProcessed: [result: {
    transmissionInfo: any
    batches: any[]
    config: QRSenderConfig
  }]
}>()

const fileInput = ref<HTMLInputElement>()
const file = ref<File | null>(null)
const isDragOver = ref(false)
const isProcessing = ref(false)

const config = reactive<QRSenderConfig>({
  batchSize: 10,
  rotationSpeed: 2000,
  chunkSize: 2900
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    file.value = target.files[0]
  }
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragOver.value = false
  
  if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
    file.value = event.dataTransfer.files[0]
  }
}

function clearFile() {
  file.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function startTransfer() {
  if (!file.value) return
  
  isProcessing.value = true
  try {
    const processor = new FileProcessor(config)
    const result = await processor.processFile(file.value)
    
    emit('fileProcessed', {
      ...result,
      config
    })
  } catch (error) {
    console.error('File processing failed:', error)
    alert('Failed to process file')
  } finally {
    isProcessing.value = false
  }
}
</script>

<style scoped>
.file-uploader {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafafa;
}

.upload-area:hover,
.upload-area.dragover {
  border-color: #007bff;
  background: #f0f8ff;
}

.upload-prompt {
  color: #666;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-hint {
  font-size: 14px;
  color: #999;
  margin-top: 8px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
}

.file-icon {
  font-size: 32px;
}

.file-details {
  flex: 1;
  position: relative;
}

.file-details h3 {
  margin: 0 0 4px 0;
  color: #333;
}

.file-details p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.clear-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
}

.config-section {
  margin-top: 24px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.config-section h3 {
  margin: 0 0 16px 0;
  color: #333;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-item label {
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.config-item input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.start-btn {
  width: 100%;
  padding: 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.start-btn:hover:not(:disabled) {
  background: #0056b3;
}

.start-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>