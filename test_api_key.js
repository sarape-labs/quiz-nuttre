import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/public/quiz/1/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 'test' })
    });
    console.log(await res.text());
  } catch (e) {
    console.error(e);
  }
}

test();
