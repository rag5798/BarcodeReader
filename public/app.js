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
let scannerInterval = null
let overlayAnimFrame = null
let scanLineColor = 'red'
 
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
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        video.srcObject = scannerStream
        await video.play()
        scannerActive = true
        container.style.display = 'block'
        drawOverlay()
        scannerInterval = setInterval(scanLine, 150)
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
 
    // Dark overlay top and bottom
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, overlay.width, overlay.height * 0.45)
    ctx.fillRect(0, overlay.height * 0.55, overlay.width, overlay.height * 0.45)
 
    // Replace the red line section with a target box
    ctx.strokeStyle = scanLineColor
    ctx.lineWidth = 2
    ctx.strokeRect(20, overlay.height * 0.35, overlay.width - 40, overlay.height * 0.30)
 
    overlayAnimFrame = requestAnimationFrame(drawOverlay)
}
 
async function scanLine() {
    const video = document.getElementById('scanner-video')
    const capture = document.getElementById('scanner-capture')

    if (video.readyState !== video.HAVE_ENOUGH_DATA) return

    scanLineColor = scanLineColor === 'red' ? 'orange' : 'red'

    // Larger strip so camera can focus at a comfortable distance
    const stripHeight = 200
    const stripWidth = video.videoWidth
    capture.width = stripWidth
    capture.height = stripHeight

    const captureCtx = capture.getContext('2d')
    const sourceY = (video.videoHeight / 2) - (stripHeight / 2)
    captureCtx.drawImage(video, 0, sourceY, stripWidth, stripHeight, 0, 0, stripWidth, stripHeight)

    console.log('Scanning frame...')

    try {
        const hints = new Map()
        const formats = [
            ZXing.BarcodeFormat.EAN_13,
            ZXing.BarcodeFormat.UPC_A,
            ZXing.BarcodeFormat.UPC_E,
            ZXing.BarcodeFormat.EAN_8
        ]
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats)
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true)

        const reader = new ZXing.MultiFormatReader()
        reader.setHints(hints)

        const luminanceSource = new ZXing.HTMLCanvasElementLuminanceSource(capture)
        const binaryBitmap = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(luminanceSource))
        const result = reader.decode(binaryBitmap)

        if (result) {
            document.getElementById('barcode-input').value = result.getText()
            stopScanner()
            lookupBarcode()
        }
    } catch (e) {
        // No barcode found in this frame, keep scanning
    }
}
 
function stopScanner() {
    clearInterval(scannerInterval)
    cancelAnimationFrame(overlayAnimFrame)
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop())
        scannerStream = null
    }
    document.getElementById('scanner-container').style.display = 'none'
    scannerActive = false
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
        const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
        const data = await res.json()

        if (data.status === 1) {
            const product = data.product
            currentProduct = {
                name: product.product_name || 'Unknown',
                brand: product.brands || 'Unknown',
                barcode: barcode
            }
            document.getElementById('product-name').textContent = currentProduct.name
            document.getElementById('product-brand').textContent = currentProduct.brand
            document.getElementById('product-info').style.display = 'block'
        } else {
            await showAlert('Product not found. Try another barcode.')
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