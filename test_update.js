import db from './server/db.js';

try {
  const updateQuiz = db.prepare(`
    UPDATE quizzes 
    SET title = ?, subtitle = ?, slug = ?, number_of_questions = ?, ai_prompt = ?, ai_max_words = ?, redirect_potential = ?, redirect_not_interested = ?, theme = ?
    WHERE id = ?
  `);
  
  updateQuiz.run('test', 'test', 'CreadorDeIngresos', 5, 'test', 100, '', '', '{}', '75dfde85-a86d-4472-a654-8bc8a43393cc');
  console.log("Success");
} catch (e) {
  console.error("Error:", e.message);
}
