<template>
  <div id="app" :class="{ fullscreen: isFullscreen }">
    <header class="app-header">
      <h1>QUAR - QR Code File Transfer</h1>
      <nav class="app-nav">
        <button 
          @click="currentView = 'sender'"
          :class="{ active: currentView === 'sender' }"
          class="nav-btn"
        >
          Send File
        </button>
        <button 
          @click="currentView = 'receiver'"
          :class="{ active: currentView === 'receiver' }"
          class="nav-btn"
        >
          Receive File
        </button>
      </nav>
    </header>

    <main class="app-main">
      <div v-if="currentView === 'sender'" class="view-container">
        <FileUploader 
          v-if="!senderData"
          @file-processed="handleFileProcessed"
        />
        <QRSender 
          v-else
          :transmission-info="senderData.transmissionInfo"
          :batches="senderData.batches"
          :config="senderData.config"
        />
        <button 
          v-if="senderData"
          @click="resetSender"
          class="reset-btn"
        >
          Send Different File
        </button>
      </div>

      <div v-else-if="currentView === 'receiver'" class="view-container">
        <QRReceiver />
      </div>
    </main>

    <footer class="app-footer">
      <div class="footer-content">
        <p>Transfer files securely using QR codes</p>
        <div class="footer-info">
          <span>Protocol: QRDT v1.0</span>
          <span>Encoding: Base32</span>
          <span>Max chunk size: ~2.9KB</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import FileUploader from './components/FileUploader.vue'
import QRSender from './components/QRSender.vue'
import QRReceiver from './components/QRReceiver.vue'

type ViewType = 'sender' | 'receiver'

const currentView = ref<ViewType>('sender')
const senderData = ref<any>(null)

const isFullscreen = computed(() => {
  return (currentView.value === 'sender' && senderData.value) || currentView.value === 'receiver'
})

function handleFileProcessed(data: any) {
  senderData.value = data
}

function resetSender() {
  senderData.value = null
}
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Full viewport mode for QR sender/receiver */
#app.fullscreen {
  height: 100vh;
  overflow: hidden;
}

#app.fullscreen .app-header,
#app.fullscreen .app-footer {
  display: none;
}

#app.fullscreen .app-main {
  padding: 0;
  height: 100vh;
}

.app-header {
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  padding: 16px 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.app-header h1 {
  text-align: center;
  color: #333;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 16px;
}

.app-nav {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.nav-btn {
  padding: 10px 20px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.nav-btn:hover {
  background: #e9ecef;
}

.nav-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.app-main {
  flex: 1;
  padding: 20px;
}

.view-container {
  max-width: 1200px;
  margin: 0 auto;
}

.reset-btn {
  display: block;
  margin: 20px auto 0;
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}

.reset-btn:hover {
  background: #545b62;
}

.app-footer {
  background: #343a40;
  color: white;
  padding: 20px;
  margin-top: auto;
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.footer-content p {
  margin-bottom: 12px;
  font-size: 16px;
}

.footer-info {
  display: flex;
  justify-content: center;
  gap: 24px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #adb5bd;
}

.footer-info span {
  padding: 4px 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
}

@media (max-width: 768px) {
  .app-header {
    padding: 12px 16px;
  }
  
  .app-header h1 {
    font-size: 24px;
    margin-bottom: 12px;
  }
  
  .app-nav {
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  
  .nav-btn {
    width: 200px;
  }
  
  .app-main {
    padding: 16px;
  }
  
  .footer-info {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .app-header h1 {
    font-size: 20px;
  }
  
  .nav-btn {
    width: 150px;
    padding: 8px 16px;
    font-size: 13px;
  }
  
  .app-main {
    padding: 12px;
  }
}
</style>