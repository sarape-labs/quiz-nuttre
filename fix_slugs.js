import db from './server/db.js';

try {
  const quizzes = db.prepare("SELECT id, slug FROM quizzes WHERE slug IS NULL OR slug = ''").all();
  const updateStmt = db.prepare('UPDATE quizzes SET slug = ? WHERE id = ?');
  
  for (const q of quizzes) {
    const newSlug = `quiz-${q.id.substring(0, 8)}`;
    updateStmt.run(newSlug, q.id);
    console.log(`Updated quiz ${q.id} to slug ${newSlug}`);
  }
  console.log("Done");
} catch (e) {
  console.error("Error:", e.message);
}
