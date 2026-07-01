const express = require('express')
const router = express.Router()
const Product = require('../database/products')

// GET a product by barcode — checks local cache first, falls back to Open Food Facts
router.get('/:barcode', async (req, res) => {
    const { barcode } = req.params

    try {
        const cached = await Product.findOne({ barcode })
        if (cached) {
            return res.json({ barcode: cached.barcode, name: cached.name, brand: cached.brand, source: 'cache' })
        }

        const apiRes = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`)
        const data = await apiRes.json()

        if (data.status !== 1) {
            return res.status(404).json({ message: 'Product not found' })
        }

        const name = data.product.product_name || 'Unknown'
        const brand = data.product.brands || 'Unknown'

        await Product.create({ barcode, name, brand })

        res.json({ barcode, name, brand, source: 'api' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

module.exports = router
