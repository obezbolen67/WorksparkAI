// server/models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  apiKey: {
    type: String,
    default: '',
  },
  baseUrl: {
    type: String,
    default: '',
  },
  selectedModel: {
    type: String,
    default: '',
  },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);