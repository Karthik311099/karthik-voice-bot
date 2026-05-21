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

    // Microsoft Edge TTS is significantly faster than OpenAI for mobile delivery.
    // It provides near-instant natural human speech.
    // Voice: en-US-GuyNeural (The professional male voice you liked on Edge PC)
    const ttsUrl = `https://api.vocalremover.org/api/v1/tts-stream?text=${encodeURIComponent(text)}&voice=en-US-GuyNeural`;

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
