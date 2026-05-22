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

    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-realtime-preview-2024-12-17",
        voice: "onyx",
        instructions: systemPrompt,
        turn_detection: {
          type: "server_vad",
        },
        input_audio_transcription: {
          model: "whisper-1",
        },
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error("OpenAI Session error:", data.error);
      throw new Error(data.error.message || 'Failed to create session');
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("Session Handler error:", error);
    return new Response(JSON.stringify({ error: error.message || 'Failed to generate session token' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
