// server/routes/models.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const OpenAI = require('openai');

// @route   POST api/models
// @desc    Fetch available LLM models from provider
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.apiKey) {
      return res.status(400).json({ error: 'API key not configured. Please save your settings first.' });
    }
    
    const openai = new OpenAI({
      apiKey: user.apiKey,
      baseURL: user.baseUrl || undefined,
    });

    const modelsList = await openai.models.list();
    
    // Sort models alphabetically by ID
    const sortedModels = modelsList.data.sort((a, b) => a.id.localeCompare(b.id));

    res.json(sortedModels);

  } catch (error) {
    console.error('Error fetching models:', error);
    // Try to send a more helpful error message from the LLM provider
    const message = error.response?.data?.error?.message || error.message || 'Failed to fetch models from the provider.';
    res.status(500).json({ error: message });
  }
});

module.exports = router;