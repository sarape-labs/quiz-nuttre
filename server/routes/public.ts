import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.ts';

const router = express.Router();

// Get quiz by slug
router.get('/quiz/:slug', (req, res) => {
  try {
    const quizStmt = db.prepare('SELECT * FROM quizzes WHERE slug = ?');
    const quiz = quizStmt.get(req.params.slug) as any;

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionsStmt = db.prepare('SELECT id, question_text, positive_text, negative_text, order_number FROM questions WHERE quiz_id = ? ORDER BY order_number ASC');
    const questions = questionsStmt.all(quiz.id);

    const resultImagesStmt = db.prepare('SELECT id, image_url, order_index FROM result_images WHERE quiz_id = ? ORDER BY order_index ASC');
    const result_images = resultImagesStmt.all(quiz.id);

    // Don't send AI prompt or results mapping to public client
    const { ai_prompt, redirect_potential, redirect_not_interested, ...publicQuiz } = quiz;

    res.json({ ...publicQuiz, questions, result_images });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

import { GoogleGenAI } from '@google/genai';

// Submit a response
router.post('/quiz/:id/response', (req, res) => {
  const { question_id, answer, session_id } = req.body;
  const quizId = req.params.id;

  try {
    const insertResponse = db.prepare(`
      INSERT INTO responses (id, quiz_id, question_id, answer, session_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertResponse.run(uuidv4(), quizId, question_id, answer, session_id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Track analytics event
router.post('/quiz/:id/track', (req, res) => {
  const { event_type, question_number, session_id } = req.body;
  const quizId = req.params.id;

  try {
    const insertAnalytics = db.prepare(`
      INSERT INTO analytics (id, quiz_id, event_type, question_number, session_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertAnalytics.run(uuidv4(), quizId, event_type, question_number || null, session_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to save analytics:', error);
    res.status(500).json({ error: 'Failed to save analytics' });
  }
});

// Get results without lead
router.post('/quiz/:id/result', async (req, res) => {
  const { session_id } = req.body;
  const quizId = req.params.id;

  try {
    // 1. Get all responses for this session
    const responsesStmt = db.prepare(`
      SELECT r.answer, q.order_number, q.question_text 
      FROM responses r
      JOIN questions q ON r.question_id = q.id
      WHERE r.session_id = ? AND r.quiz_id = ?
      ORDER BY q.order_number ASC
    `);
    const responses = responsesStmt.all(session_id, quizId);

    // 2. Generate combination string (e.g., '10101')
    const combination = responses.map((r: any) => r.answer).join('');

    // 3. Get quiz config
    const quizStmt = db.prepare('SELECT * FROM quizzes WHERE id = ?');
    const quiz = quizStmt.get(quizId) as any;

    // 4. Check for predefined result
    const resultStmt = db.prepare('SELECT result_text FROM results WHERE quiz_id = ? AND combination = ?');
    const predefinedResult = resultStmt.get(quizId, combination) as any;

    let finalResultText = predefinedResult ? predefinedResult.result_text : null;

    // 5. If no predefined result, generate automatic text
    if (!finalResultText) {
      const positiveAnswers = responses.filter((r: any) => r.answer === 1).map((r: any) => r.order_number);
      if (positiveAnswers.length === 0) {
        finalResultText = "El usuario no respondió sí en ninguna pregunta.";
      } else if (positiveAnswers.length === 1) {
        finalResultText = `El usuario contestó que sí solo a la pregunta ${positiveAnswers[0]}.`;
      } else {
        const last = positiveAnswers.pop();
        finalResultText = `El usuario contestó que sí a ${positiveAnswers.join(', ')} y ${last}.`;
      }
    }

    // 6. Return promptContext for AI interpretation
    let promptContext = null;
    let aiInterpretation = null;
    if (quiz.ai_prompt) {
      promptContext = `Quiz:"${quiz.title}".Respuestas:${responses.map((r: any) => `P${r.order_number}:${r.answer === 1 ? 'Sí' : 'No'}`).join(',')}.Instrucciones:${quiz.ai_prompt}.Responde en max 80 palabras.`;
      
      const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: promptContext,
            config: {
              systemInstruction: "Eres un experto. Responde de forma concisa en máximo 80 palabras.",
            }
          });
          aiInterpretation = response.text;
        } catch (e) {
          console.error('AI error in backend:', e);
        }
      }
    }

    // 7. Determine redirect URL based on score
    const score = responses.filter((r: any) => r.answer === 1).length;
    const isHighPotential = score >= (quiz.number_of_questions / 2);
    
    // Use fallback if one of the URLs is missing
    let redirectUrl = isHighPotential ? quiz.redirect_potential : quiz.redirect_not_interested;
    if (!redirectUrl) {
      redirectUrl = isHighPotential ? quiz.redirect_not_interested : quiz.redirect_potential;
    }

    res.json({
      success: true,
      combination,
      resultText: finalResultText,
      promptContext,
      aiInterpretation,
      redirectUrl: redirectUrl || null
    });

  } catch (error) {
    console.error('Get result error:', error);
    res.status(500).json({ error: 'Failed to get quiz result' });
  }
});

// Submit lead
router.post('/quiz/:id/lead', async (req, res) => {
  const { nombre, email, session_id } = req.body;
  const quizId = req.params.id;

  try {
    // Check if email already exists for this quiz
    const existingLead = db.prepare('SELECT id FROM leads WHERE quiz_id = ? AND email = ?').get(quizId, email);
    if (existingLead) {
      return res.status(400).json({ error: 'Este correo ya ha sido registrado para este quiz.' });
    }

    const insertLead = db.prepare(`
      INSERT INTO leads (id, quiz_id, nombre, email, session_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertLead.run(uuidv4(), quizId, nombre, email, session_id);

    res.json({ success: true });
  } catch (error) {
    console.error('Submit lead error:', error);
    res.status(500).json({ error: 'Failed to submit lead' });
  }
});

export default router;
