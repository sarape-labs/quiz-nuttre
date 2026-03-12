import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  db.exec(`
    ALTER TABLE quizzes ADD COLUMN result_closing_text TEXT;
    ALTER TABLE quizzes ADD COLUMN result_button_text TEXT;
    ALTER TABLE quizzes ADD COLUMN lead_title TEXT;
    ALTER TABLE quizzes ADD COLUMN lead_description TEXT;
    ALTER TABLE quizzes ADD COLUMN lead_button_text TEXT;
  `);
  console.log("Columns added successfully.");
} catch (e) {
  console.log("Columns might already exist:", e.message);
}
