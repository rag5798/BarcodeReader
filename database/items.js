const mongoose = require('mongoose')

const itemSchema = new mongoose.Schema({
    name: String,
    brand: String,
    barcode: String,
    expirationDate: Date,
    addedDate: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('items', itemSchema)