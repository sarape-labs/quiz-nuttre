import db from './server/db.js';

try {
  const updateQuiz = db.prepare(`
    UPDATE quizzes 
    SET title = ?, subtitle = ?, slug = ?, number_of_questions = ?, ai_prompt = ?, ai_max_words = ?, redirect_potential = ?, redirect_not_interested = ?, theme = ?
    WHERE id = ?
  `);
  
  updateQuiz.run('¡Descubre tu potencial!', '(Subtítulo)', 'CreadorDeIngresos', 5, 'Interpreta las respuestas del usuario y genera una lectura tipo horóscopo motivador invitándolo a ver el video.', 100, '', '', '{}', '75dfde85-a86d-4472-a654-8bc8a43393cc');
  console.log("Success");
} catch (e) {
  console.error("Error:", e.message);
}
