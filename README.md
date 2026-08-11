# ShelfWatch — Barcode Inventory Scanner

**Live demo:** [barcodereader-87hr.onrender.com](https://barcodereader-87hr.onrender.com)
*(Hosted on Render's free tier — the first load after idle can take up to a minute.)*

A web-based inventory tool that scans product barcodes and stores items in a database. The idea came from working in grocery retail, where quickly logging and looking up products by barcode is a genuinely useful task.

Users can scan a barcode with their camera (or upload an image of one), and the app decodes it and records the item. Products can then be looked up by their barcode.

## Features

- **Barcode scanning** from a live camera feed using Quagga2
- **Barcode decoding from images** using ZXing (WASM)
- **Server-side image processing** with Sharp to prepare uploaded images for decoding
- **Inventory storage** in MongoDB
- **REST API** for creating, listing, and deleting inventory items, and for looking up products by barcode
- **File uploads** handled with Multer

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Database | MongoDB + Mongoose |
| Barcode (client) | @ericblade/quagga2 |
| Barcode (decode) | zxing-wasm |
| Image processing | sharp |
| Uploads | multer |

## API Endpoints

**Items** (`/api/items`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | List all inventory items |
| POST | `/` | Add a new item |
| DELETE | `/:id` | Delete an item by ID |

**Products** (`/api/products`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/:barcode` | Look up a product by its barcode |

## Getting Started

### Prerequisites

- Node.js (v18 or newer recommended)
- A MongoDB database (local or hosted)

### Installation

```bash
git clone https://github.com/rag5798/BarcodeReader.git
cd BarcodeReader
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```
MONGODB_URI=your_mongodb_connection_string
PORT=3000
```

### Running the App

```bash
npm start
```

Visit `http://localhost:3000`.

## Project Structure

```
├── database/   # MongoDB connection setup
├── routes/     # API routes (items, products)
├── public/     # Front-end (camera scanning UI)
└── server.js   # App entry point
```

## What I Learned

- How barcode decoding works in the browser vs. from a static image
- Using Sharp to preprocess images server-side so they decode more reliably
- Handling file uploads through an Express API with Multer
- Wiring a scanning front-end to a REST backend and a database

## Note

This was a fast, AI-assisted build used to prototype the idea over a short time. I've since reviewed the codebase to understand how the scanning, image processing, and API layers fit together.

## Possible Improvements

- Look up product names/details from an external barcode database on scan
- Add quantity tracking and low-stock alerts
- Add authentication so multiple users can maintain separate inventories
