import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text } = await req.json();

    if (!text) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // This is an unofficial Google Translate TTS endpoint that works for short-medium texts
    // It returns a high-quality, consistent male-ish voice (en-us)
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&total=1&idx=0&textlen=${text.length}&client=tw-ob&prev=input`;

    return new Response(JSON.stringify({ audioUrl: ttsUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("TTS Handler error:", error);
    return new Response(JSON.stringify({ error: 'Failed to generate audio' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
