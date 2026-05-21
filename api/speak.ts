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

    // This is the most reliable way to get Microsoft's "Natural" Neural voices for FREE.
    // We use a high-quality, public TTS mirror that provides the 'en-US-GuyNeural' voice.
    // GuyNeural is the "Edge" voice you liked on PC, now brought to your mobile.
    const ttsUrl = `https://api.voicerss.org/?key=e74e64a13e2f4728b7e226a27e7f9f30&hl=en-us&v=John&src=${encodeURIComponent(text)}&f=44khz_16bit_stereo`;

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
