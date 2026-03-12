import db from './server/db.js';

try {
  const quizzes = db.prepare('SELECT * FROM quizzes').all();
  console.log(quizzes);
} catch (e) {
  console.error("Error:", e.message);
}
