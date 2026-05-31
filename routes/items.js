const express = require('express')
const router = express.Router()
const Item = require('../database/items')

// GET all items
router.get('/', async (req, res) => {
    try {
        const items = await Item.find()
        res.json(items)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

// POST a new item
router.post('/', async (req, res) => {
    const item = new Item({
        name: req.body.name,
        brand: req.body.brand,
        barcode: req.body.barcode,
        expirationDate: req.body.expirationDate
    })
    try {
        const newItem = await item.save()
        res.status(201).json(newItem)
    } catch (error) {
        res.status(400).json({ message: error.message })
    }
})

// DELETE an item by id
router.delete('/:id', async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id)
        res.json({ message: 'Item deleted' })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

module.exports = router