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

    // --- Python Analogy: This is a simple list of strings to filter noise ---
    const hallucinations = [
      "thank you.",
      "thanks for watching.", 
      "subtitle by", 
      "subtitles by",
      "you",
      "the",
      "[silence]", 
      "[music]",
      "[bgm]",
      "."
    ];
    
    const cleanText = transcribedText.toLowerCase().trim();
    // If the text is just noise or a common "Whisper hallucination", ignore it
    if (cleanText.length < 2 || hallucinations.some(h => cleanText === h)) {
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
