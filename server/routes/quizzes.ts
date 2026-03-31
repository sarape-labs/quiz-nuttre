import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.ts';
import { requireAuth } from './auth.ts';

const router = express.Router();

router.use(requireAuth);

// Helper to check permissions
const checkQuizPermission = (req: express.Request, res: express.Response, quizId: string) => {
  const user = (req as any).user;
  if (user.rol === 'superadmin' || user.rol === 'admin') return true;
  
  const quiz = db.prepare('SELECT created_by FROM quizzes WHERE id = ?').get(quizId) as any;
  if (!quiz) {
    res.status(404).json({ error: 'Quiz not found' });
    return false;
  }
  
  if (user.rol === 'asistente' && quiz.created_by !== user.id) {
    res.status(403).json({ error: 'No tienes permiso para modificar este quiz' });
    return false;
  }
  
  return true;
};

// Get all active quizzes
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM quizzes WHERE status = 'active' OR status IS NULL ORDER BY created_at DESC");
    const quizzes = stmt.all();
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get all trashed quizzes
router.get('/trash', (req, res) => {
  try {
    const stmt = db.prepare("SELECT * FROM quizzes WHERE status = 'trash' ORDER BY created_at DESC");
    const quizzes = stmt.all();
    res.json(quizzes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trashed quizzes' });
  }
});

// Get single quiz with questions and results
router.get('/:id', (req, res) => {
  try {
    const quizStmt = db.prepare('SELECT * FROM quizzes WHERE id = ?');
    const quiz = quizStmt.get(req.params.id) as any;

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questionsStmt = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_number ASC');
    const questions = questionsStmt.all(req.params.id).map((q: any) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : []
    }));

    const resultsStmt = db.prepare('SELECT * FROM results WHERE quiz_id = ?');
    const results = resultsStmt.all(req.params.id);

    const resultImagesStmt = db.prepare('SELECT * FROM result_images WHERE quiz_id = ? ORDER BY order_index ASC');
    const result_images = resultImagesStmt.all(req.params.id);

    res.json({ ...quiz, questions, results, result_images });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// Create new quiz
router.post('/', (req, res) => {
  let { title, subtitle, cover_image, slug, number_of_questions = 5, ai_prompt, ai_max_words = 100, redirect_potential, redirect_not_interested, theme, result_closing_text, result_button_text, lead_title, lead_description, lead_button_text, result_images = [], quiz_type = 'binary' } = req.body;
  
  if (ai_prompt && ai_prompt.length > 500) {
    return res.status(400).json({ error: 'El prompt de IA no puede exceder los 500 caracteres.' });
  }

  const id = uuidv4();

  if (!slug || slug.trim() === '') {
    slug = `quiz-${id.substring(0, 8)}`;
  }

  try {
    const insertQuiz = db.prepare(`
      INSERT INTO quizzes (id, title, subtitle, cover_image, slug, number_of_questions, ai_prompt, ai_max_words, redirect_potential, redirect_not_interested, theme, result_closing_text, result_button_text, lead_title, lead_description, lead_button_text, quiz_type, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    insertQuiz.run(id, title, subtitle, cover_image || null, slug, number_of_questions, ai_prompt, ai_max_words, redirect_potential, redirect_not_interested, JSON.stringify(theme || {}), result_closing_text, result_button_text, lead_title, lead_description, lead_button_text, quiz_type, (req as any).user.id);

    // Insert result images
    if (Array.isArray(result_images) && result_images.length > 0) {
      const insertResultImage = db.prepare(`
        INSERT INTO result_images (id, quiz_id, image_url, order_index)
        VALUES (?, ?, ?, ?)
      `);
      result_images.slice(0, 10).forEach((img: any, index: number) => {
        insertResultImage.run(uuidv4(), id, img.image_url || img, index);
      });
    }

    // Create default questions
    const insertQuestion = db.prepare(`
      INSERT INTO questions (id, quiz_id, question_text, positive_text, negative_text, order_number, question_type, options)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= number_of_questions; i++) {
      const defaultOptions = quiz_type === 'multiple_choice' ? JSON.stringify([{ text: '', profile: '' }, { text: '', profile: '' }]) : '[]';
      insertQuestion.run(uuidv4(), id, '', '', '', i, quiz_type, defaultOptions);
    }

    res.status(201).json({ id, message: 'Quiz created successfully' });
  } catch (error: any) {
    console.error('Create quiz error:', error);
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'El slug ya está en uso por otro quiz.' });
    }
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Update quiz
router.put('/:id', (req, res) => {
  const quizId = req.params.id;

  if (!checkQuizPermission(req, res, quizId)) return;

  let { title, subtitle, cover_image, slug, number_of_questions, ai_prompt, ai_max_words, redirect_potential, redirect_not_interested, theme, result_closing_text, result_button_text, lead_title, lead_description, lead_button_text, result_images, quiz_type } = req.body;
  
  if (ai_prompt && ai_prompt.length > 500) {
    return res.status(400).json({ error: 'El prompt de IA no puede exceder los 500 caracteres.' });
  }

  if (!slug || slug.trim() === '') {
    slug = `quiz-${req.params.id.substring(0, 8)}`;
  }

  try {
    const updateQuiz = db.prepare(`
      UPDATE quizzes 
      SET title = ?, subtitle = ?, cover_image = ?, slug = ?, number_of_questions = ?, ai_prompt = ?, ai_max_words = ?, redirect_potential = ?, redirect_not_interested = ?, theme = ?, result_closing_text = ?, result_button_text = ?, lead_title = ?, lead_description = ?, lead_button_text = ?, quiz_type = ?
      WHERE id = ?
    `);
    
    updateQuiz.run(title, subtitle, cover_image || null, slug, number_of_questions, ai_prompt, ai_max_words, redirect_potential, redirect_not_interested, JSON.stringify(theme || {}), result_closing_text, result_button_text, lead_title, lead_description, lead_button_text, quiz_type || 'binary', req.params.id);

    // Update result images
    if (result_images !== undefined) {
      db.prepare('DELETE FROM result_images WHERE quiz_id = ?').run(req.params.id);
      if (Array.isArray(result_images) && result_images.length > 0) {
        const insertResultImage = db.prepare(`
          INSERT INTO result_images (id, quiz_id, image_url, order_index)
          VALUES (?, ?, ?, ?)
        `);
        result_images.slice(0, 10).forEach((img: any, index: number) => {
          insertResultImage.run(uuidv4(), req.params.id, img.image_url || img, index);
        });
      }
    }
    res.json({ message: 'Quiz updated successfully' });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'El slug ya está en uso por otro quiz.' });
    }
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Update questions
router.put('/:id/questions', (req, res) => {
  const { questions } = req.body;
  const quizId = req.params.id;

  if (!checkQuizPermission(req, res, quizId)) return;

  try {
    const existingIds = questions.filter((q: any) => q.id).map((q: any) => q.id);
    
    db.transaction(() => {
      // Delete questions that are no longer in the list
      if (existingIds.length > 0) {
        const placeholders = existingIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM questions WHERE quiz_id = ? AND id NOT IN (${placeholders})`).run(quizId, ...existingIds);
      } else {
        db.prepare(`DELETE FROM questions WHERE quiz_id = ?`).run(quizId);
      }

      const updateQuestion = db.prepare(`
        UPDATE questions 
        SET question_text = ?, positive_text = ?, negative_text = ?, order_number = ?, question_type = ?, options = ?
        WHERE id = ? AND quiz_id = ?
      `);

      const insertQuestion = db.prepare(`
        INSERT INTO questions (id, quiz_id, question_text, positive_text, negative_text, order_number, question_type, options)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const q of questions) {
        const qType = q.question_type || 'binary';
        const qOptions = q.options ? JSON.stringify(q.options) : '[]';
        const pText = q.positive_text || '';
        const nText = q.negative_text || '';
        if (q.id) {
          updateQuestion.run(q.question_text, pText, nText, q.order_number, qType, qOptions, q.id, quizId);
        } else {
          insertQuestion.run(uuidv4(), quizId, q.question_text, pText, nText, q.order_number, qType, qOptions);
        }
      }
    })();

    res.json({ message: 'Questions updated successfully' });
  } catch (error) {
    console.error('Update questions error:', error);
    res.status(500).json({ error: 'Failed to update questions' });
  }
});

// Update results mapping
router.put('/:id/results', (req, res) => {
  const { results } = req.body; // Array of { combination: '10101', result_text: '...' }
  const quizId = req.params.id;

  if (!checkQuizPermission(req, res, quizId)) return;

  try {
    const deleteResults = db.prepare('DELETE FROM results WHERE quiz_id = ?');
    const insertResult = db.prepare(`
      INSERT INTO results (id, quiz_id, combination, result_text)
      VALUES (?, ?, ?, ?)
    `);

    db.transaction(() => {
      deleteResults.run(quizId);
      for (const r of results) {
        insertResult.run(uuidv4(), quizId, r.combination, r.result_text);
      }
    })();

    res.json({ message: 'Results updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update results' });
  }
});

// Get leads for a quiz
router.get('/:id/leads', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM leads WHERE quiz_id = ? ORDER BY created_at DESC');
    const leads = stmt.all(req.params.id);
    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Delete a lead
router.delete('/:id/leads/:leadId', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM leads WHERE id = ? AND quiz_id = ?');
    const result = stmt.run(req.params.leadId, req.params.id);
    if (result.changes > 0) {
      res.json({ message: 'Lead deleted successfully' });
    } else {
      res.status(404).json({ error: 'Lead not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Get analytics for a quiz
router.get('/:id/stats', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM analytics WHERE quiz_id = ? ORDER BY created_at DESC');
    const analytics = stmt.all(req.params.id);
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Soft delete quiz (move to trash)
router.delete('/:id', (req, res) => {
  const quizId = req.params.id;
  if (!checkQuizPermission(req, res, quizId)) return;
  try {
    db.prepare("UPDATE quizzes SET status = 'trash' WHERE id = ?").run(quizId);
    res.json({ message: 'Quiz moved to trash' });
  } catch (error) {
    console.error('Trash quiz error:', error);
    res.status(500).json({ error: 'Failed to move quiz to trash' });
  }
});

// Restore quiz
router.put('/:id/restore', (req, res) => {
  const quizId = req.params.id;
  if (!checkQuizPermission(req, res, quizId)) return;
  try {
    db.prepare("UPDATE quizzes SET status = 'active' WHERE id = ?").run(quizId);
    res.json({ message: 'Quiz restored successfully' });
  } catch (error) {
    console.error('Restore quiz error:', error);
    res.status(500).json({ error: 'Failed to restore quiz' });
  }
});

// Permanent delete quiz
router.delete('/:id/permanent', (req, res) => {
  const quizId = req.params.id;
  if (!checkQuizPermission(req, res, quizId)) return;
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM analytics WHERE quiz_id = ?').run(quizId);
      db.prepare('DELETE FROM leads WHERE quiz_id = ?').run(quizId);
      db.prepare('DELETE FROM responses WHERE quiz_id = ?').run(quizId);
      db.prepare('DELETE FROM results WHERE quiz_id = ?').run(quizId);
      db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quizId);
      db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
    })();
    res.json({ message: 'Quiz permanently deleted' });
  } catch (error) {
    console.error('Permanent delete quiz error:', error);
    res.status(500).json({ error: 'Failed to permanently delete quiz' });
  }
});

// Generate AI analysis for a quiz
router.post('/:id/ai-analysis', async (req, res) => {
  try {
    const quizId = req.params.id;
    
    const quizStmt = db.prepare('SELECT * FROM quizzes WHERE id = ?');
    const quiz = quizStmt.get(quizId) as any;

    const analyticsStmt = db.prepare('SELECT * FROM analytics WHERE quiz_id = ?');
    const analytics = analyticsStmt.all(quizId) as any[];

    const totalOpens = analytics.filter(a => a.event_type === 'quiz_open').length;
    const totalStarts = analytics.filter(a => a.event_type === 'quiz_start').length;
    const totalCompletes = analytics.filter(a => a.event_type === 'quiz_completed').length;
    const totalLeads = analytics.filter(a => a.event_type === 'lead_submitted').length;

    const questionDrops = analytics.filter(a => a.event_type === 'question_answered').reduce((acc: any, curr: any) => {
      acc[curr.question_number] = (acc[curr.question_number] || 0) + 1;
      return acc;
    }, {});

    const promptContext = `Analiza stats de "${quiz.title}": Aperturas:${totalOpens}, Inicios:${totalStarts}, Completados:${totalCompletes}, Leads:${totalLeads}. Respuestas/pregunta:${JSON.stringify(questionDrops)}. Da observaciones y tips de conversión en Markdown.`;

    res.json({ promptContext });
  } catch (error) {
    console.error('AI Analysis error:', error);
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

export default router;
