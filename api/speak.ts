export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // Support both POST and GET for maximum flexibility
  // GET is much faster for mobile as it allows direct <audio src="..."> streaming
  const url = new URL(req.url);
  let text = '';

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      text = body.text;
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }
  } else {
    text = url.searchParams.get('text') || '';
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!text) {
    return new Response(JSON.stringify({ error: 'No text provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // OpenAI TTS API call
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // High-speed model
        input: text,
        voice: 'onyx', // Deep professional male voice
        response_format: 'mp3', // MP3 is most compatible with mobile audio elements
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    // Return the response body directly as a stream. 
    // The browser's <audio> element will play this as it downloads.
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error("OpenAI TTS error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
