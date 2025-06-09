// server/routes/settings.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET api/settings
// @desc    Get current user settings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // Find user by id from token, exclude the password
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   PUT api/settings
// @desc    Update user settings
// @access  Private
router.put('/', auth, async (req, res) => {
  const { apiKey, baseUrl, selectedModel } = req.body;

  // Build settings object based on what was passed
  const settingsFields = {};
  if (apiKey !== undefined) settingsFields.apiKey = apiKey;
  if (baseUrl !== undefined) settingsFields.baseUrl = baseUrl;
  if (selectedModel !== undefined) settingsFields.selectedModel = selectedModel;

  try {
    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Update user
    user = await User.findByIdAndUpdate(
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

module.exports = router;