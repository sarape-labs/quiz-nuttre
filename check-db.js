import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new Database(dbPath);

const users = db.prepare('SELECT id, usuario, rol FROM users').all();
console.log('Users in DB:', JSON.stringify(users, null, 2));

const quizzes = db.prepare('SELECT id, slug FROM quizzes').all();
console.log('Quizzes in DB:', JSON.stringify(quizzes, null, 2));
