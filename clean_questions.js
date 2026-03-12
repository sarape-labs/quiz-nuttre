import db from './server/db.js';

try {
  // Keep only the latest 5 questions for the quiz
  const questions = db.prepare('SELECT * FROM questions ORDER BY order_number ASC, rowid DESC').all();
  const seen = new Set();
  const toDelete = [];
  
  for (const q of questions) {
    const key = `${q.quiz_id}-${q.order_number}`;
    if (seen.has(key)) {
      toDelete.push(q.id);
    } else {
      seen.add(key);
    }
  }
  
  if (toDelete.length > 0) {
    const placeholders = toDelete.map(() => '?').join(',');
    db.prepare(`DELETE FROM questions WHERE id IN (${placeholders})`).run(...toDelete);
    console.log(`Deleted ${toDelete.length} duplicate questions`);
  } else {
    console.log("No duplicates found");
  }
} catch (e) {
  console.error("Error:", e.message);
}
