export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
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
    // Switching to 'opus' format. 
    // Opus is the industry standard for low-latency audio (used by Discord/WhatsApp).
    // It is MUCH smaller than MP3, so it starts playing almost instantly on mobile networks.
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // High-speed model
        input: text,
        voice: 'onyx', 
        response_format: 'opus', // <--- Change to Opus for speed
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'OpenAI API error');
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'audio/ogg', // Opus is served in an Ogg container
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
