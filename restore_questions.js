import db from './server/db.js';
import { v4 as uuidv4 } from 'uuid';

try {
  const quizId = '75dfde85-a86d-4472-a654-8bc8a43393cc';
  
  // Delete all existing questions for this quiz
  db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quizId);
  
  const insertQuestion = db.prepare(`
    INSERT INTO questions (id, quiz_id, question_text, positive_text, negative_text, order_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const questions = [
    {
      q: "¿Te gustaría ganar más dinero del que hoy estás ganando?",
      p: "¡Definitivamente sí!",
      n: "No, ya gano muchísimo."
    },
    {
      q: "¿Sientes que podrías hacer mucho más y que estás desaprovechando tus talentos y habilidades?",
      p: "¡Claro que puedo hacer mucho más!",
      n: "No, así estoy bien."
    },
    {
      q: "¿Eres de las personas que disfruta ayudar a los demás cuando lo necesitan?",
      p: "Sí, me gusta ayudar a las personas.",
      n: "Prefiero enfocarme en lo mío."
    },
    {
      q: "¿Te interesan temas como cuidado personal, viajes, ejercicio, salud y belleza? (Afinidad con estilo de vida / bienestar)",
      p: "¡Sí, me gusta mucho sentirme bien todos los días!",
      n: "La verdad no es algo que me llame."
    },
    {
      q: "Si existiera una forma de ganar dinero ayudando a los demás y disfrutando un estilo de vida saludable, ¿te gustaría conocerla?",
      p: "¡Por supuesto que sí quiero!",
      n: "No, gracias."
    }
  ];

  for (let i = 0; i < questions.length; i++) {
    insertQuestion.run(uuidv4(), quizId, questions[i].q, questions[i].p, questions[i].n, i + 1);
  }
  
  console.log("Successfully restored the 5 questions.");
} catch (e) {
  console.error("Error:", e.message);
}
