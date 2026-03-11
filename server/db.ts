import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    usuario TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT,
    rol TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    title TEXT,
    subtitle TEXT,
    cover_image TEXT,
    number_of_questions INTEGER DEFAULT 5,
    ai_prompt TEXT,
    ai_max_words INTEGER DEFAULT 50,
    redirect_potential TEXT,
    redirect_not_interested TEXT,
    theme TEXT,
    result_closing_text TEXT,
    result_button_text TEXT,
    lead_title TEXT,
    lead_description TEXT,
    lead_button_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT,
    question_text TEXT,
    positive_text TEXT,
    negative_text TEXT,
    order_number INTEGER,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY,
    quiz_id TEXT,
    combination TEXT,
    result_text TEXT,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    quiz_id TEXT,
    question_id TEXT,
    answer INTEGER,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    quiz_id TEXT,
    nombre TEXT,
    email TEXT,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id TEXT PRIMARY KEY,
    quiz_id TEXT,
    event_type TEXT,
    question_number INTEGER,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS result_images (
    id TEXT PRIMARY KEY,
    quiz_id TEXT,
    image_url TEXT,
    order_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
  );
`);

// Add columns if they don't exist (migrations)
const addColumn = (table: string, column: string, type: string) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  } catch (e) {
    // Column might already exist or error
  }
};

// Add slug without UNIQUE constraint first, then create index
addColumn('quizzes', 'slug', 'TEXT');
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_slug ON quizzes(slug)');
} catch (e) {}

addColumn('quizzes', 'title', 'TEXT');
addColumn('quizzes', 'subtitle', 'TEXT');
addColumn('quizzes', 'cover_image', 'TEXT');
addColumn('quizzes', 'number_of_questions', 'INTEGER DEFAULT 5');
addColumn('quizzes', 'ai_prompt', 'TEXT');
addColumn('quizzes', 'ai_max_words', 'INTEGER DEFAULT 50');
addColumn('quizzes', 'redirect_potential', 'TEXT');
addColumn('quizzes', 'redirect_not_interested', 'TEXT');
addColumn('quizzes', 'theme', 'TEXT');
addColumn('quizzes', 'status', "TEXT DEFAULT 'active'");

// Seed initial superadmin user
const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
const adminUser = stmt.get('admin@sarape.com');

if (!adminUser) {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, nombre, usuario, email, password, rol)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('admin123', salt); // Default password
  insertUser.run(uuidv4(), 'Super Admin', 'SarapeComunicacion', 'admin@sarape.com', hash, 'superadmin');
}

export default db;
