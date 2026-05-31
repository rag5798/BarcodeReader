let currentProduct = null

async function lookupBarcode() {
    const barcode = document.getElementById('barcode-input').value.trim()
    if (!barcode) return alert('Please enter a barcode')

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
        alert('Product not found. Try another barcode.')
    }
}

async function saveItem() {
    if (!currentProduct) return alert('Look up a barcode first')
    const expirationDate = document.getElementById('expiration-date').value
    if (!expirationDate) return alert('Please select an expiration date')

    await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentProduct, expirationDate })
    })

    currentProduct = null
    document.getElementById('barcode-input').value = ''
    document.getElementById('expiration-date').value = ''
    document.getElementById('product-info').style.display = 'none'
    loadItems()
}

async function deleteItem(id) {
    await fetch(`/api/items/${id}`, { method: 'DELETE' })
    loadItems()
}

async function loadItems() {
    const res = await fetch('/api/items')
    const items = await res.json()

    // Sort by closest expiration date
    items.sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate))

    const container = document.getElementById('items-list')
    container.innerHTML = ''

    const today = new Date()

    items.forEach(item => {
        const expDate = new Date(item.expirationDate)
        const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
        const isExpiringSoon = daysLeft <= 3

        const card = document.createElement('div')
        card.className = `item-card ${isExpiringSoon ? 'expiring-soon' : ''}`
        card.innerHTML = `
            <div class="item-info">
                <h3>${item.name}</h3>
                <p>${item.brand}</p>
                <p>Expires: ${expDate.toLocaleDateString()} (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)</p>
            </div>
            <button class="delete-btn" onclick="deleteItem('${item._id}')">✓</button>
        `
        container.appendChild(card)
    })
}

// ******************************* Camera scanning functionality using ZXing library *******************************
async function scanPhoto(event) {
    const file = event.target.files[0]
    if (!file) return

    const html5QrCode = new Html5Qrcode('camera-preview')

    try {
        const result = await html5QrCode.scanFile(file, false)
        document.getElementById('barcode-input').value = result
        lookupBarcode()
    } catch (error) {
        // First attempt failed, try again with enhanced settings
        try {
            const result = await html5QrCode.scanFile(file, true)
            document.getElementById('barcode-input').value = result
            lookupBarcode()
        } catch (secondError) {
            alert('Could not read barcode. Please try a clearer photo or enter manually.')
        }
    } finally {
        // Reset so the same photo can be retried if needed
        document.getElementById('barcode-photo').value = ''
    }
}

loadItems()