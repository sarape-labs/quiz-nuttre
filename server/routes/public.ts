import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.ts';
import { GoogleGenAI } from '@google/genai';

const router = express.Router();

// Get quiz by slug
router.get('/quiz/:slug', (req, res) => {
  try {
    const quizStmt = db.prepare('SELECT * FROM quizzes WHERE slug = ?');
    const quiz = quizStmt.get(req.params.slug) as any;

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionsStmt = db.prepare('SELECT id, question_text, positive_text, negative_text, order_number, question_type, options FROM questions WHERE quiz_id = ? ORDER BY order_number ASC');
    const questions = questionsStmt.all(quiz.id).map((q: any) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : []
    }));

    const resultImagesStmt = db.prepare('SELECT id, image_url, order_index FROM result_images WHERE quiz_id = ? ORDER BY order_index ASC');
    const result_images = resultImagesStmt.all(quiz.id);

    // Don't send AI prompt or results mapping to public client
    const { ai_prompt, redirect_potential, redirect_not_interested, ...publicQuiz } = quiz;

    res.json({ ...publicQuiz, questions, result_images });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

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
      SELECT r.answer, q.order_number, q.question_text, q.question_type, q.options 
      FROM responses r
      JOIN questions q ON r.question_id = q.id
      WHERE r.session_id = ? AND r.quiz_id = ?
      ORDER BY q.order_number ASC
    `);
    const responses = responsesStmt.all(session_id, quizId).map((r: any) => ({
      ...r,
      options: r.options ? JSON.parse(r.options) : []
    }));

    // 2. Generate combination string (e.g., '10101')
    const combination = responses.map((r: any) => r.answer).join('');

    // 3. Get quiz config
    const quizStmt = db.prepare('SELECT * FROM quizzes WHERE id = ?');
    const quiz = quizStmt.get(quizId) as any;

    // 4. Check for predefined result
    const resultStmt = db.prepare('SELECT result_text FROM results WHERE quiz_id = ? AND combination = ?');
    const predefinedResult = resultStmt.get(quizId, combination) as any;

    let finalResultText = predefinedResult ? predefinedResult.result_text : null;

    // 5. Try AI Generation if ai_prompt exists and no predefined result
    if (!finalResultText && quiz.ai_prompt && quiz.ai_prompt.trim() !== '') {
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (apiKey) {
        try {
          const answersText = responses.map((r: any) => {
            if (r.question_type === 'multiple_choice') {
              const opt = r.options[r.answer];
              const optionText = typeof opt === 'object' ? opt.text : (opt || r.answer);
              return `P${r.order_number}: ${optionText}`;
            }
            return `P${r.order_number}: ${r.answer === 1 ? 'Sí' : 'No'}`;
          }).join(' | ');

          let promptContext = '';
          if (quiz.quiz_type === 'multiple_choice') {
            const profileScores: Record<string, number> = {};
            responses.forEach((r: any) => {
              if (r.question_type === 'multiple_choice' && r.options && r.options[r.answer]) {
                const opt = r.options[r.answer];
                const profile = typeof opt === 'object' && opt.profile ? opt.profile.trim() : null;
                if (profile) {
                  profileScores[profile] = (profileScores[profile] || 0) + 1;
                }
              }
            });
            
            let dominantProfile = 'Indefinido';
            let maxScore = -1;
            Object.entries(profileScores).forEach(([profile, score]) => {
              if (score > maxScore) {
                maxScore = score;
                dominantProfile = profile;
              }
            });
            
            promptContext = `El usuario ha completado el quiz "${quiz.title}".\nRespuestas seleccionadas: ${answersText}.\nPerfil dominante detectado por el sistema: ${dominantProfile}.\n\nInstrucciones: ${quiz.ai_prompt}`;
          } else {
            promptContext = `Quiz:"${quiz.title}".\nRespuestas:${answersText}.\nInstrucciones:${quiz.ai_prompt}.`;
          }

          const systemInstruction = `Eres un experto. Responde de forma concisa en máximo ${quiz.ai_max_words || 50} palabras.`;

          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: promptContext,
            config: {
              systemInstruction: systemInstruction,
            }
          });
          
          if (response.text) {
            finalResultText = response.text;
          }
        } catch (aiError) {
          console.error('AI Generation Error in backend:', aiError);
        }
      } else {
        console.warn('GEMINI_API_KEY is missing in backend environment variables');
      }
    }

    // 6. Generic Fallback if both predefined and AI failed/were missing
    if (!finalResultText) {
      if (quiz.quiz_type === 'multiple_choice') {
        finalResultText = "Has completado el quiz. Hemos registrado tus respuestas.";
      } else {
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
    }

    // 7. Determine redirect URL based on score
    let isHighPotential = true;
    if (quiz.quiz_type !== 'multiple_choice') {
      const score = responses.filter((r: any) => r.answer === 1).length;
      isHighPotential = score >= (quiz.number_of_questions / 2);
    }
    
    // Use fallback if one of the URLs is missing
    let redirectUrl = isHighPotential ? quiz.redirect_potential : quiz.redirect_not_interested;
    if (!redirectUrl) {
      redirectUrl = isHighPotential ? quiz.redirect_not_interested : quiz.redirect_potential;
    }

    res.json({
      success: true,
      combination,
      resultText: finalResultText,
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
