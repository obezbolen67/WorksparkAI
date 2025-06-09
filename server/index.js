// server/index.js

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');
require('dotenv').config();
const authMiddleware = require('./middleware/auth'); // --- MODIFIED: Import auth middleware
const User = require('./models/User'); // --- MODIFIED: Import User model

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// --- NEW: Define auth routes ---
app.use('/api/auth', require('./routes/auth'));

app.get('/', (req, res) => {
  res.send('Team Chat AI Server is running!');
});

// --- MODIFIED: Protect this route and use user's settings ---
app.post('/api/models', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('apiKey baseUrl');
    if (!user || !user.apiKey) {
      return res.status(400).json({ error: 'API key is required. Please set it in your settings.' });
    }

    const openai = new OpenAI({
      apiKey: user.apiKey,
      baseURL: user.baseUrl || undefined,
    });
    
    const modelsList = await openai.models.list();
    const allModels = modelsList.data.map(model => ({ id: model.id }));
    
    res.json(allModels);

  } catch (error) {
    console.error('Model Fetch Error:', error);
    const statusCode = error.status || 500;
    const errorMessage = error.message || 'An error occurred fetching models.';
    res.status(statusCode).json({ error: errorMessage });
  }
});

// --- MODIFIED: Protect this route and use user's settings ---
app.post('/api/chat', authMiddleware, async (req, res) => {
  const { messages } = req.body;

  try {
    const user = await User.findById(req.user.id).select('apiKey baseUrl selectedModel');
    if (!user || !user.apiKey) {
      return res.status(400).json({ error: 'API key is required.' });
    }
    if (!user.selectedModel) {
      return res.status(400).json({ error: 'A model must be selected.' });
    }

    const openai = new OpenAI({
      apiKey: user.apiKey,
      baseURL: user.baseUrl || undefined,
    });

    const stream = await openai.chat.completions.create({
      model: user.selectedModel,
      messages: messages,
      stream: true,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.end();

  } catch (error) {
    console.error('OpenAI API Error:', error);
    const statusCode = error.status || 500;
    const errorMessage = error.message || 'An error occurred with the OpenAI API.';
    // Note: Can't send a status code here as headers are already sent for the stream
    // The error will be caught on the client side when the stream closes unexpectedly.
  }
});

// --- NEW: Route to get and update user settings ---
app.route('/api/settings')
  .get(authMiddleware, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select('-password');
      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  })
  .put(authMiddleware, async (req, res) => {
    const { apiKey, baseUrl, selectedModel } = req.body;
    const settingsFields = { apiKey, baseUrl, selectedModel };

    try {
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { $set: settingsFields },
        { new: true }
      ).select('-password');
      res.json(user);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  });


mongoose.connect(process.env.MONGO_URI, {})
.then(() => {
  console.log('MongoDB connected successfully.');
  app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
  });
})
.catch(err => {
  console.error('Database connection failed:', err);
  process.exit(1);
});