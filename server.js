const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/chat', async (req, res) => {
  const { message, history } = req.body;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    res.json({ reply: result.text() });
  } catch (err) {
    res.status(500).json({ error: 'AI error' });
  }
});

// Instead of using the API key in frontend, send requests to your backend:
// fetch('https://your-render-url.onrender.com/chat', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ message: userMessage, history: messages.history })
// })
// .then(res => res.json())
// .then(data => {
//   // Use data.reply in your chat window
// });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));