const mongoose = require('mongoose');

const WhitelistSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  }
}, { collection: 'whitelist' });

module.exports = mongoose.model('Whitelist', WhitelistSchema);
