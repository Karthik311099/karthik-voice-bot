// --- Python Developer Note: This is like a Flask route that streams binary data (MP3/Opus) ---

export const config = {
  runtime: 'edge', // Runs at the network edge for ultra-low latency
};

export default async function handler(req: Request) {
  // We support POST here for receiving text in a JSON body
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    // Equivalent to: data = await request.json()
    const { text } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY missing.' }), { status: 500 });
    }

    if (!text) {
      return new Response(JSON.stringify({ error: 'No text provided' }), { status: 400 });
    }

    // OpenAI TTS-1 is the ultra-fast version of their text-to-speech model
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // Fast model for real-time interaction
        input: text,
        voice: 'onyx', // Professional male voice
        response_format: 'mp3', // MP3 is decoded fast by phone hardware
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    // Return the response body directly as a stream. 
    // Just like return StreamingResponse(stream_body, media_type="audio/mpeg") in FastAPI
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
