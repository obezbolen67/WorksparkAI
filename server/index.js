// server/index.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Connect to Database ---
// Make sure your .env file has a MONGO_URI variable
mongoose.connect(process.env.MONGO_URI, {})
  .then(() => {
    console.log('MongoDB connected successfully.');
    // Start the server only after a successful DB connection
    app.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

// --- Init Middleware ---
// Allows cross-origin requests
app.use(cors());
// Allows the app to accept JSON in request bodies
app.use(express.json());


// --- Define API Routes ---
// The main file now just directs traffic to the correct route file.

// A simple root route to check if the server is running
app.get('/', (req, res) => {
  res.send('Fexo AI Server is running!');
});

// All authentication-related requests go to the auth router
app.use('/api/auth', require('./routes/auth'));

// All settings-related requests go to the settings router
app.use('/api/settings', require('./routes/settings'));

// The route for fetching available LLM models
app.use('/api/models', require('./routes/models'));

// All chat session management (creating, fetching, messaging, streaming)
app.use('/api/chats', require('./routes/chats'));
