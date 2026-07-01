let currentProduct = null

// ── Modal helpers (replace native alert/confirm) ──────────────────────────────
function showAlert(message) {
    return new Promise(resolve => {
        document.getElementById('modal-message').textContent = message
        document.getElementById('modal-cancel').style.display = 'none'
        document.getElementById('modal-confirm').textContent = 'OK'
        document.getElementById('modal-overlay').classList.add('active')

        document.getElementById('modal-confirm').onclick = () => {
            document.getElementById('modal-overlay').classList.remove('active')
            resolve()
        }
    })
}

function showConfirm(message) {
    return new Promise(resolve => {
        document.getElementById('modal-message').textContent = message
        document.getElementById('modal-cancel').style.display = ''
        document.getElementById('modal-confirm').textContent = 'Confirm'
        document.getElementById('modal-overlay').classList.add('active')

        document.getElementById('modal-confirm').onclick = () => {
            document.getElementById('modal-overlay').classList.remove('active')
            resolve(true)
        }
        document.getElementById('modal-cancel').onclick = () => {
            document.getElementById('modal-overlay').classList.remove('active')
            resolve(false)
        }
    })
}
// ─────────────────────────────────────────────────────────────────────────────

const picker = new Pikaday({
    field: document.getElementById('expiration-date'),
    container: document.getElementById('calendar-container'),
    bound: false,
    format: 'YYYY-MM-DD',
    minDate: new Date(),
    onSelect: function(date) {
        document.getElementById('expiration-date').value = date.toISOString().split('T')[0]
    }
})
 
let scannerActive = false
let scannerStream = null
let overlayAnimFrame = null
let scanLineColor = 'red'
let zxingReader = null

function getZXingReader() {
    if (zxingReader) return zxingReader
    const hints = new Map()
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.UPC_E,
    ])
    // TRY_HARDER is for single-shot images — it's too slow for live video
    hints.set(ZXing.DecodeHintType.TRY_HARDER, false)
    zxingReader = new ZXing.MultiFormatReader()
    zxingReader.setHints(hints)
    return zxingReader
}

async function toggleScanner() {
    if (scannerActive) {
        stopScanner()
    } else {
        startScanner()
    }
}

async function startScanner() {
    const container = document.getElementById('scanner-container')
    const video = document.getElementById('scanner-video')

    try {
        scannerStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                advanced: [{ focusMode: 'continuous' }]
            }
        })
        video.srcObject = scannerStream
        await video.play()
        scannerActive = true
        container.style.display = 'block'
        drawOverlay()
        scanLoop()
    } catch (error) {
        await showAlert('Camera access denied or unavailable.')
    }
}

function drawOverlay() {
    const video = document.getElementById('scanner-video')
    const overlay = document.getElementById('scanner-overlay')
    const ctx = overlay.getContext('2d')

    overlay.width = video.clientWidth
    overlay.height = video.clientHeight

    ctx.clearRect(0, 0, overlay.width, overlay.height)

    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, overlay.width, overlay.height * 0.35)
    ctx.fillRect(0, overlay.height * 0.65, overlay.width, overlay.height * 0.35)

    ctx.strokeStyle = scanLineColor
    ctx.lineWidth = 2
    ctx.strokeRect(20, overlay.height * 0.35, overlay.width - 40, overlay.height * 0.30)

    overlayAnimFrame = requestAnimationFrame(drawOverlay)
}

// setTimeout-based loop — waits for each frame to finish before scheduling
// the next, so a slow decode can never pile up a backlog of pending calls
async function scanLoop() {
    if (!scannerActive) return
    await scanFrame()
    if (scannerActive) setTimeout(scanLoop, 80)
}

async function scanFrame() {
    const video = document.getElementById('scanner-video')
    const capture = document.getElementById('scanner-capture')

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return

    scanLineColor = scanLineColor === 'red' ? 'rgba(255,100,0,0.9)' : 'red'

    const stripH = Math.floor(video.videoHeight * 0.30)
    const stripW = video.videoWidth
    capture.width = stripW
    capture.height = stripH

    // willReadFrequently tells the browser to optimize this canvas for pixel reads
    const ctx = capture.getContext('2d', { willReadFrequently: true })
    const srcY = (video.videoHeight - stripH) / 2

    // Contrast boost makes barcode edges sharper for blurry cameras
    ctx.filter = 'contrast(160%) brightness(105%)'
    ctx.drawImage(video, 0, srcY, stripW, stripH, 0, 0, stripW, stripH)
    ctx.filter = 'none'

    const reader = getZXingReader()
    const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(capture)
    let result = null

    // HybridBinarizer: better on sharp, high-contrast frames
    try {
        result = reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource)))
    } catch (e) {}

    // GlobalHistogramBinarizer: better on blurry or low-contrast frames
    if (!result) {
        try {
            result = reader.decode(new ZXing.BinaryBitmap(new ZXing.GlobalHistogramBinarizer(luminanceSource)))
        } catch (e) {}
    }

    if (result) {
        document.getElementById('barcode-input').value = result.getText()
        stopScanner()
        lookupBarcode()
    }
}

function stopScanner() {
    cancelAnimationFrame(overlayAnimFrame)
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop())
        scannerStream = null
    }
    document.getElementById('scanner-container').style.display = 'none'
    scannerActive = false
    zxingReader = null
}
 
// Auto focus barcode input on load
document.getElementById('barcode-input').focus()
 
// Auto lookup when 12 digits entered
document.getElementById('barcode-input').addEventListener('input', (e) => {
    if (e.target.value.length === 12) {
        lookupBarcode()
    }
})
 
async function lookupBarcode() {
    const barcode = document.getElementById('barcode-input').value.trim()
    if (!barcode) {
        await showAlert('Please enter a barcode.')
        return
    }

    try {
        const res = await fetch(`/api/products/${barcode}`)

        if (res.ok) {
            const data = await res.json()
            currentProduct = {
                name: data.name,
                brand: data.brand,
                barcode: barcode
            }
            document.getElementById('product-name').textContent = currentProduct.name
            document.getElementById('product-brand').textContent = currentProduct.brand
            document.getElementById('product-info').style.display = 'block'
        } else if (res.status === 404) {
            await showAlert('Product not found. Try another barcode.')
        } else {
            throw new Error('Lookup failed')
        }
    } catch (err) {
        await showAlert('Failed to reach the product database. Check your connection.')
    }
}
 
async function saveItem() {
    if (!currentProduct) {
        await showAlert('Look up a barcode first.')
        return
    }
    const expirationDate = document.getElementById('expiration-date').value
    if (!expirationDate) {
        await showAlert('Please select an expiration date.')
        return
    }

    try {
        const res = await fetch('/api/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...currentProduct, expirationDate })
        })
        if (!res.ok) throw new Error('Save failed')

        currentProduct = null
        document.getElementById('barcode-input').value = ''
        document.getElementById('product-info').style.display = 'none'
        document.getElementById('barcode-input').focus()
        await loadItems()
    } catch (err) {
        await showAlert('Failed to save the item. Please try again.')
    }
}
 
async function deleteItem(id, name) {
    const confirmed = await showConfirm(`Remove "${name}" from the list?`)
    if (!confirmed) return

    try {
        const res = await fetch(`/api/items/${id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('Delete failed')
        await loadItems()
    } catch (err) {
        await showAlert('Failed to remove the item. Please try again.')
    }
}
 
async function loadItems() {
    // Default date to 7 days from today
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 7)
    picker.setDate(defaultDate)

    let items
    try {
        const res = await fetch('/api/items')
        if (!res.ok) throw new Error('Fetch failed')
        items = await res.json()
    } catch (err) {
        await showAlert('Could not load items from the database.')
        return
    }
 
    // Sort by closest expiration date
    items.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))
 
    const container = document.getElementById('items-list')
    container.innerHTML = ''
 
    // Normalize today to UTC midnight so daysLeft math aligns with stored UTC dates
    const now = new Date()
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

    items.forEach(item => {
        const expDate = new Date(item.expirationDate)
        const daysLeft = Math.ceil((expDate.getTime() - today) / (1000 * 60 * 60 * 24))
        const isExpiringSoon = daysLeft <= 3
 
        const card = document.createElement('div')
        card.className = `item-card ${isExpiringSoon ? 'expiring-soon' : ''}`
        card.innerHTML = `
            <div class="item-info">
                <h3>${item.name}</h3>
                <p>${item.brand}</p>
                <p>Expires: ${expDate.toLocaleDateString(undefined, { timeZone: 'UTC' })} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)</p>
            </div>
            <button class="delete-btn" onclick="deleteItem('${item._id}', '${item.name}')">✓</button>
        `
        container.appendChild(card)
    })
}
 
loadItems()