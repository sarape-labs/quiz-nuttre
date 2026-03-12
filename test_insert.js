import db from './server/db.js';

try {
  const insertQuiz = db.prepare(`
    INSERT INTO quizzes (id, title, subtitle, slug, number_of_questions, ai_prompt, ai_max_words, redirect_potential, redirect_not_interested, theme)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertQuiz.run('test-id-2', 'test', 'test', '', 5, 'test', 100, '', '', '{}');
  console.log("Success");
} catch (e) {
  console.error("Error:", e.message);
}
