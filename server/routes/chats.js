// server/routes/chats.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Chat = require('../models/Chat');
const User = require('../models/User');
const OpenAI = require('openai');

// @route   GET /api/chats
// @desc    Get all chat sessions for a user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user.id })
      .select('_id title updatedAt')
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/chats
// @desc    Create a new chat session (for the very first message)
router.post(
  '/',
  [auth, [body('messages', 'Initial messages are required').isArray({ min: 1 })]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const { messages } = req.body;
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (!firstUserMessage) {
        return res.status(400).json({ error: 'No user message found.' });
      }

      const newChat = new Chat({
        user: req.user.id,
        title: firstUserMessage.content.substring(0, 40) + (firstUserMessage.content.length > 40 ? '...' : ''),
        messages: messages,
      });

      const chat = await newChat.save();
      res.status(201).json(chat);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route   GET /api/chats/:id
// @desc    Get a single chat with all messages
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ msg: 'Chat not found' });
    if (chat.user.toString() !== req.user.id) return res.status(401).json({ msg: 'Not authorized' });
    res.json(chat);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/chats/:id/stream
// @desc    Stream a response for a chat, using provided message history
router.post('/:id/stream', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const chat = await Chat.findById(req.params.id);
        const { messages: messagesFromClient } = req.body;

        if (!user || !chat || chat.user.toString() !== req.user.id) {
            return res.status(404).json({ error: 'Chat or user not found' });
        }
        if (!user.apiKey) {
            return res.status(400).json({ error: 'API key not configured' });
        }
        if (!messagesFromClient || !Array.isArray(messagesFromClient)) {
            return res.status(400).json({ error: 'A message history is required.' });
        }
        
        const openai = new OpenAI({
            apiKey: user.apiKey,
            baseURL: user.baseUrl || undefined
        });
        
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await openai.chat.completions.create({
            model: user.selectedModel || 'gpt-3.5-turbo',
            messages: messagesFromClient.map(m => ({ role: m.role, content: m.content })),
            stream: true,
        });

        let fullAssistantResponse = '';
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullAssistantResponse += content;
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }
        
        if (fullAssistantResponse) {
            const finalMessages = [...messagesFromClient, { role: 'assistant', content: fullAssistantResponse }];
            chat.messages = finalMessages;
            // Update title if it's an edited first message
            if (finalMessages.length === 2 && finalMessages[0].role === 'user') {
                 chat.title = finalMessages[0].content.substring(0, 40) + (finalMessages[0].content.length > 40 ? '...' : '');
            }
            await chat.save();
        }

        res.end();
    } catch (error) {
        console.error('Streaming error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Failed to get response from LLM.' })}\n\n`);
        res.end();
    }
});

module.exports = router;