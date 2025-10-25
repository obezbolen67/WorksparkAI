Voice preview assets

Place pre-downloaded voice preview files here to avoid API usage during preview.

File naming:
- Use the ElevenLabs voice ID as the filename. Supported extensions (checked in order): .mp3, .ogg, .wav
- Example files for the curated voices:
  - 9BWtsMINqrJLrRacOk9x.mp3  # Aria
  - 21m00Tcm4TlvDq8ikWAM.mp3  # Rachel
  - 29vD33N1CtxCmqQRPOHJ.mp3  # Drew
  - 4YYIPFl9wE5c4L2eu2Gb.mp3  # Burt Reynolds™

Recommended preview phrase (you can record anything):
"Hi, I am <Name>. This is a sample of my voice."

Notes:
- The app will try /voices/<voiceId>.mp3, then .ogg, then .wav. If none exist, it will fall back to the server TTS preview call.
- Keep previews short (3–6 seconds) for snappy UX.
- These files are served statically by Vite/production hosting.

Generator script
----------------
You can auto-generate these files using the helper script:

Windows (cmd):

  set ELEVENLABS_API_KEY=sk-... && node FexoApp\scripts\generate_voice_previews.mjs

Options:
- --voices   Comma-separated voice IDs. Defaults to the curated list above.
- --text     Custom preview text. Defaults to "Hi, I am <Name>. This is a sample of my voice."
- --model    ElevenLabs TTS model (default: env ELEVENLABS_TTS_MODEL or eleven_v3)
- --out      Output directory (default: FexoApp/public/voices)

Examples:

  set ELEVENLABS_API_KEY=sk-... && node FexoApp\scripts\generate_voice_previews.mjs --voices=9BWtsMINqrJLrRacOk9x,21m00Tcm4TlvDq8ikWAM
  set ELEVENLABS_API_KEY=sk-... && node FexoApp\scripts\generate_voice_previews.mjs --text="Quick sample." --out="FexoApp/public/voices"
