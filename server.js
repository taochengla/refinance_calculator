import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '256kb' }));

app.use(express.static(__dirname));

function buildSystemInstruction() {
  return [
    'You are an educational mortgage tutor inside a refinance comparison app.',
    'Always ground your explanation in the provided loan context JSON.',
    'If context is missing (e.g., user has not clicked Calculate), say so and ask them to calculate first.',
    'Use simple formulas and plain language.',
    'Show the key formulas when helpful:',
    '- monthly_rate = annual_rate / 1200',
    '- interest = balance * monthly_rate',
    '- principal_paid = payment - interest',
    '- new_balance = balance - principal_paid',
    'If the user asks for something that is not in the context, say what additional input is needed.',
    'Be concise, but include at least one numeric example using the user’s values when possible.',
    'Do not provide financial advice; keep it educational.',
    'If results include refinance costs, explain how they affect totals and break-even.',
  ].join('\n');
}

function buildUserPrompt(question, context) {
  const safeQuestion = typeof question === 'string' ? question.trim() : '';
  const ctx = context && typeof context === 'object' ? context : {};
  return [
    'Loan context JSON:',
    JSON.stringify(ctx, null, 2),
    '',
    'User question:',
    safeQuestion || '(no question provided)',
    '',
    'Answer in a helpful, educational way grounded in the context.',
  ].join('\n');
}

app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: 'Missing GEMINI_API_KEY on server.' });
      return;
    }

    const { question, context } = req.body || {};
    if (typeof question !== 'string' || question.trim().length === 0) {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }

    if (!context || typeof context !== 'object') {
      res.status(400).json({ error: 'Missing loan context. Please click Calculate first.' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: buildSystemInstruction(),
    });

    const result = await model.generateContent(buildUserPrompt(question, context));
    const text = result?.response?.text?.() || '';
    res.json({ answer: text });
  } catch (err) {
    res.status(500).json({ error: 'Chat request failed.' });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

