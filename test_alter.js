import db from './server/db.js';

try {
  db.exec('ALTER TABLE quizzes ADD COLUMN slug2 TEXT UNIQUE');
  console.log("Success");
} catch (e) {
  console.error("Error:", e.message);
}
