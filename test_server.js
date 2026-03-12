import express from 'express';
import publicRoutes from './server/routes/public.js';
import { v4 as uuidv4 } from 'uuid';
import db from './server/db.js';

const app = express();
app.use(express.json());
app.use('/api/public', publicRoutes);

// Insert dummy data
const quizId = uuidv4();
const sessionId = uuidv4();

try {
  db.prepare('INSERT INTO quizzes (id, title, user_id, ai_prompt) VALUES (?, ?, ?, ?)').run(quizId, 'Test Quiz', 'test_user', 'Analyze this');
  db.prepare('INSERT INTO questions (id, quiz_id, order_number, question_text) VALUES (?, ?, ?, ?)').run(uuidv4(), quizId, 1, 'Q1');
} catch (e) {
  console.log("Data might exist");
}

app.listen(3001, async () => {
  console.log('Server running');
  try {
    const res = await fetch(`http://localhost:3001/api/public/quiz/${quizId}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId })
    });
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
});
