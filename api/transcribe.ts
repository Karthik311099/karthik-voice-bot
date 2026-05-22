// --- Python Developer Note: This is exactly like a Flask/FastAPI route for audio processing ---
// Similar to using: transcription = openai.Audio.transcribe("whisper-1", audio_file)

export const config = {
  runtime: 'edge', // Runs on Vercel's global network
};

export default async function handler(req: Request) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Equivalent to: form_data = await request.form()
    const formData = await req.formData();
    const file = formData.get('file') as File; // Get the audio file from the payload

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY is missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Convert file to a buffer that Groq understands
    const arrayBuffer = await file.arrayBuffer();
    
    // Prepare multi-part form data for Groq - like creating a dict for requests.post(files=...)
    const groqFormData = new FormData();
    groqFormData.append('file', new Blob([arrayBuffer], { type: file.type }), 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3'); // High-accuracy model

    // Send to Groq for Speech-to-Text
    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqFormData,
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok || data.error) {
      console.error("Groq Whisper error:", data.error || data);
      return new Response(JSON.stringify({ error: data.error?.message || 'Transcription failed' }), {
        status: groqResponse.status || 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let transcribedText = data.text || "";

    // --- AGGRESSIVE SILENCE GUARD: Prevents Whisper from "inventing" speech from noise ---
    const hallucinations = [
      "thank you",
      "thanks for watching",
      "subtitle",
      "subscribe",
      "you",
      "the",
      "um",
      "uh",
      "is",
      "a",
      "i",
      "it",
      "so",
      "by",
      "[silence]",
      "[music]",
      "[bgm]",
      "."
    ];

    // Normalize: remove all punctuation, lowercase, and trim
    const normalizedText = transcribedText.toLowerCase().replace(/[.,!?;]/g, "").trim();

    // 1. Block extremely short hallucinations (Whisper often invents 1-2 common words)
    // 2. Block exact matches for known hallucination strings
    // 3. Block if the string contains common long-form hallucinations
    if (
      normalizedText.length <= 3 || 
      hallucinations.some(h => normalizedText === h) ||
      normalizedText.includes("thanks for watching") ||
      normalizedText.includes("subtitle by") ||
      normalizedText.includes("subtitles by")
    ) {
      transcribedText = "";
    }

    return new Response(JSON.stringify({ text: transcribedText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Transcription Handler error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
