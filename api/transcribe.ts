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

    // --- ENHANCED SILENCE GATE: Blocks common Whisper "hallucinations" during silence ---
    // Whisper is extremely sensitive and often "invents" these phrases from background hum.
    const strictHallucinations = [
      "thank you.",
      "thanks for watching.", 
      "subtitle by", 
      "subtitles by",
      "subscribe",
      "you",
      "the",
      "um",
      "uh",
      "a",
      "i",
      "is",
      "[silence]", 
      "[music]",
      "[bgm]",
      "."
    ];
    
    // Normalize text for comparison: remove trailing dots, lowercase, trim
    const cleanText = transcribedText.toLowerCase().trim().replace(/\.+$/, "");
    
    // 1. Block if it's an exact match for a known hallucination
    // 2. Block if it's extremely short (Whisper often hallucinates a single common word)
    // 3. Block if it contains known long-form hallucinations like "Thanks for watching"
    if (
      cleanText.length <= 2 || 
      strictHallucinations.some(h => cleanText === h.replace(/\.+$/, "")) ||
      cleanText.includes("thanks for watching") ||
      cleanText.includes("subtitle by")
    ) {
      transcribedText = "";
    }

    // Return the clean text to the frontend
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
