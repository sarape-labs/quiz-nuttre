import db from './server/db.js';

try {
  db.prepare("DELETE FROM quizzes WHERE id = 'test-id-2'").run();
  console.log("Deleted test-id-2");
} catch (e) {
  console.error("Error:", e.message);
}
