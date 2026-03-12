import db from './server/db.js';

try {
  const indexes = db.pragma('index_list(quizzes)');
  console.log(indexes);
} catch (e) {
  console.error("Error:", e.message);
}
