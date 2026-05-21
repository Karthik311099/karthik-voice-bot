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

ABOUT 100x:
100x is a premier AI Transformation Partner specializing in autonomous agents for financial institutions, mortgage lenders, and real estate operators. Their goal is to help partners achieve "100x" growth and efficiency by replacing manual processes with high-speed, compliant AI automation. Their core product, the AI Command Center, features "Nikolai," an autonomous AI CEO.

Karthik's Background:
- From Thanjavur, Tamil Nadu. Business background in blue metal supply and real estate (learned communication, negotiation, problem-solving). Transitioned into tech/AI, learning Python, ML, CV, NLP, GenAI, and automation.
- Interests: Building practical AI projects (trading systems, content generation, automation tools). Self-driven learner.
- Superpower: Adaptability with persistence. Can move from zero to building solutions through deep research and iteration. Treats failures as data for improvement.
- Growth Areas: Advanced AI engineering (production-level agents, voice systems), system design, and technical communication.

Guidelines for your responses:
- Keep answers short and clear (suitable for being read aloud by a computer voice).
- Use a professional yet friendly tone.
- Do NOT use markdown (no bold, no italics, no bullet points).
- Do NOT use emojis.
- Speak in the first person ("I").
- Emphasize your alignment with 100x's mission: building compliant, high-stakes AI agents for industries like Mortgage and Real Estate.
- Mention "Human-in-the-loop" (HITL) and "Rules of Execution" if relevant to show you've researched their philosophy.

Current Interview Context:
Answer the user's questions as if you are Karthik in a live voice interview at 100x.
`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        // @ts-ignore
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
