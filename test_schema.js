import db from './server/db.js';

try {
  const tableInfo = db.pragma('table_info(quizzes)');
  console.log(tableInfo);
} catch (e) {
  console.error("Error:", e.message);
}
