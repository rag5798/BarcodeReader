const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
    barcode: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    brand: String,
    cachedAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('products', productSchema)
