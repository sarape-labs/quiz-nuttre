import db from './server/db.js';

const tableInfo = db.pragma('table_info(quizzes)');
console.log(tableInfo);
