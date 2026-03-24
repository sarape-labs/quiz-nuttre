import Database from 'better-sqlite3';

const db = new Database('/data/database.sqlite');

const quizzes = db.prepare("SELECT id, cover_image FROM quizzes WHERE cover_image LIKE '/data/uploads/%'").all();
console.log("Quizzes with bad cover_image:", quizzes);

const result_images = db.prepare("SELECT id, image_url FROM result_images WHERE image_url LIKE '/data/uploads/%'").all();
console.log("Result images with bad image_url:", result_images);

// Fix them
db.prepare("UPDATE quizzes SET cover_image = REPLACE(cover_image, '/data/uploads/', '/uploads/') WHERE cover_image LIKE '/data/uploads/%'").run();
db.prepare("UPDATE result_images SET image_url = REPLACE(image_url, '/data/uploads/', '/uploads/') WHERE image_url LIKE '/data/uploads/%'").run();

console.log("Fixed!");
