// models/Chat.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Sub-schema for individual messages
const MessageSchema = new Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
}, { _id: false, timestamps: true }); // Add timestamps to messages if you want

// Main schema for a chat conversation
const ChatSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
    required: true,
    default: 'New Chat',
  },
  messages: [MessageSchema],
}, { timestamps: true }); // Automatically adds createdAt and updatedAt

module.exports = mongoose.model('Chat', ChatSchema);