const express = require('express')
const app = express()
const connectDB = require('./database/database')
const itemRoutes = require('./routes/items')
const productRoutes = require('./routes/products')

// Middleware
app.use(express.json())
app.use(express.static('public'))
connectDB()

// Routes
app.use('/api/items', itemRoutes)
app.use('/api/products', productRoutes)

// Start server
app.listen(3000, () => {
    console.log('Server running on port 3000')
})