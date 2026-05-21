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
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Convert file to buffer for Groq
    const arrayBuffer = await file.arrayBuffer();
    
    // We need to send this to Groq. Groq Whisper uses multipart/form-data.
    const groqFormData = new FormData();
    groqFormData.append('file', new Blob([arrayBuffer], { type: file.type }), 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        // @ts-ignore
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: groqFormData,
    });

    const data = await groqResponse.json();

    if (data.error) {
      console.error("Groq Whisper error:", data.error);
      throw new Error(data.error.message || 'Transcription error');
    }

    return new Response(JSON.stringify({ text: data.text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Transcription Handler error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to transcribe' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
