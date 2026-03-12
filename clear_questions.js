import db from './server/db.js';

try {
  const updateStmt = db.prepare(`
    UPDATE questions 
    SET question_text = '', positive_text = '', negative_text = ''
    WHERE question_text LIKE 'Pregunta %'
  `);
  const result = updateStmt.run();
  console.log(`Updated ${result.changes} questions`);
} catch (e) {
  console.error("Error:", e.message);
}
