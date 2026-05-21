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

    // Using a highly reliable, high-quality neural TTS proxy
    // Targeted Voice: en-US-GuyNeural (one of the most human-like male AI voices)
    const voiceUrl = `https://api.vocalremover.org/api/v1/tts-stream?text=${encodeURIComponent(text)}&voice=en-US-GuyNeural`;

    return new Response(JSON.stringify({ audioUrl: voiceUrl }), {
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
