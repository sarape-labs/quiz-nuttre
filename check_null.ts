import Database from 'better-sqlite3';
const db = new Database('/data/database.sqlite');
const result_images = db.prepare("SELECT * FROM result_images WHERE image_url = ''").all();
console.log("Result images with empty image_url:", result_images);
