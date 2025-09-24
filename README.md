# QUAR - QR Code File Transfer

A Vue.js web application that enables secure file transfer using QR codes. Files are encoded into a series of QR codes that can be scanned to reconstruct the original file.

## Features

- **File Upload**: Drag & drop or click to select files up to 50MB
- **QR Code Generation**: Files are split into optimized chunks and encoded as QR codes
- **Batch Transfer**: QR codes are organized into manageable batches
- **Real-time Scanning**: Continuous QR code scanning with ZXing library
- **Progress Tracking**: Visual progress indicators for both sender and receiver
- **File Verification**: SHA-256 checksum verification ensures data integrity
- **Error Handling**: Comprehensive error detection and user-friendly messages

## Protocol: QRDT v1.0

### QR Code Types
- **T**: Transmission info (filename, total chunks, checksum, file size)
- **B**: Batch info (start/end chunk numbers, batch progress)
- **D**: Data chunks (base32-encoded file data with chunk ID)

### Encoding Strategy
- **Base32** encoding for maximum QR code capacity
- **Base36** chunk numbering for compact indexing
- **~2.9KB** maximum chunk size per QR code
- **Error Correction Level L** for maximum data density

## Usage

### Sending Files
1. Click "Send File" tab
2. Upload a file via drag & drop or file picker
3. Configure batch size and rotation speed
4. Click "Start Transfer"
5. Display QR codes for scanning

### Receiving Files
1. Click "Receive File" tab
2. Click "Start Receiving"
3. Allow camera access
4. Scan QR codes until batch is complete
5. Click "Next Batch" to continue
6. Download reconstructed file when complete

## Development

### Prerequisites
- Node.js 16+
- Modern web browser with camera support

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

## Technical Details

### Dependencies
- **Vue 3**: Frontend framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **qrcode**: QR code generation
- **@zxing/library**: QR code scanning

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### Security
- Client-side only processing
- No data sent to servers
- SHA-256 integrity verification
- No permanent storage of file data

## Limitations

- Maximum file size: 50MB
- Requires camera access for receiving
- Performance depends on device capabilities
- Large files require many QR codes

## License

MIT License