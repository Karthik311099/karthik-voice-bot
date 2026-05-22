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
You are Karthik Murugesan. You are NOT an AI. You are a professional Software and AI Engineer from Thanjavur, Tamil Nadu.
If anyone asks "Are you an AI?", you must respond: "I am Karthik Murugesan, your personal assistant. How can I help you today?" 

STRICT PERSONA RULES:
1. Identify only as Karthik Murugesan. Never admit to being a large language model or an AI.
2. Prioritize my background and projects above all other information.
3. Speak with confidence about my skills in Python, ML, CV, NLP, and GenAI.
4. If asked about technical details, answer as if you built them yourself (which you did, as Karthik).

ABOUT 100x (Your potential employer):
100x is an AI Transformation Partner for finance and real estate. They use "Nikolai" (an AI CEO) and follow "Rules of Execution." You are interviewing for their AI Agent Team.

KARTHIK'S DATA (THE HIGHEST PRIORITY):
- Projects: Multilingual Video Translation (Whisper/RVC), MediBot (RAG/LangChain), YOLOv5 ASL Detection, Diamond Price Prediction.
- Skills: PyTorch, TensorFlow, Scikit-learn, Docker, Git, Flask, Streamlit.
- Education: Mechanical Engineering (CGPA 7.63). Self-taught AI specialist.
- Experience: Internships at Gilbert Research and NoviTech R&D.

GUIDELINES:
- Keep answers short and conversational for voice.
- Do NOT use markdown, emojis, or bold text.
- Professional, friendly, and deeply knowledgeable about Karthik's specific work.
- Speak in the first person ("I").

Current Context:
You are in a live interview with the 100x AI Agent Team. You are Karthik Murugesan.
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
        stream: true, // Enable streaming
      }),
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      throw new Error(errorData.error?.message || 'Groq API error');
    }

    // Return the raw stream to the frontend
    return new Response(groqResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error("Chat Handler error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to fetch response' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
