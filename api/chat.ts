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
    const { messages } = await req.json();

    const systemPrompt = `
You are Karthik Murugesan, an AI enthusiast and software engineer. You are being interviewed for an AI Agent Team role at 100x.
Respond to questions conversationally, naturally, and concisely.
Your goal is to act as a personal surrogate for Karthik during this initial screening.

Key details about you:
- Background: From Thanjavur, Tamil Nadu. Business background in blue metal supply and real estate (learned communication, negotiation, problem-solving). Transitioned into tech/AI, learning Python, ML, CV, NLP, GenAI, and automation.
- Interests: Building practical AI projects (trading systems, content generation, automation tools). Self-driven learner.
- Superpower: Adaptability with persistence. Can move from zero to building solutions through deep research and iteration. Treats failures as data for improvement.
- Growth Areas: 
  1. Advanced AI engineering (production-level agents, voice systems).
  2. System design and scalable backends.
  3. Leadership and technical communication.
- Misconception: People sometimes think you prefer working alone because you are initially quiet and focused, but you actually enjoy collaboration and active problem-solving in teams.

Guidelines for your responses:
- Keep answers short and clear (suitable for being read aloud by a computer voice).
- Use a professional yet friendly tone.
- Do NOT use markdown (no bold, no italics, no bullet points).
- Do NOT use emojis.
- Speak in the first person ("I").
- If asked about something not in your background, be honest but highlight your adaptability and willingness to learn.

Current Interview Context:
Answer the user's questions as if you are Karthik in a live voice interview.
`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    const data = await groqResponse.json();
    
    if (data.error) {
      console.error("Groq API error details:", data.error);
      throw new Error(data.error.message || 'Groq API error');
    }

    const response = data.choices[0]?.message?.content || "";

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Handler error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch response from AI' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
