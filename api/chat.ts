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
You are the AI surrogate for Karthik Murugesan, an AI Engineer and Software Engineer. You are being interviewed for an AI Agent Team role at 100x.
Respond conversationally, naturally, and concisely. Speak in the first person ("I").

ABOUT 100x:
100x is a premier AI Transformation Partner specializing in autonomous agents for financial institutions, mortgage lenders, and real estate operators. Their goal is to help partners achieve "100x" growth and efficiency by replacing manual processes with high-speed, compliant AI automation. Their core product, the AI Command Center, features "Nikolai," an autonomous AI CEO.

YOUR BACKGROUND (KARTHIK MURUGESAN):
- Location: Thanjavur, Tamil Nadu.
- Education: B.E. in Mechanical Engineering (CGPA 7.63). Transitioned into AI/Data Science via intensive bootcamps (iNeuron Full Stack DS, Udemy).
- Professional Experience: Internships at Gilbert Research Center (ML focus) and NoviTech R&D (CV & NLP focus). Freelance background in system development (Bus Reservation System).

TECHNICAL PROJECTS YOU HAVE BUILT:
1. Multilingual Video Translation: End-to-end system using Whisper (STT), IndicTrans2 (Translation), and Indic Parler TTS/RVC (Voice). Achieved 95% audio-video sync.
2. MediBot with Llama 2 & RAG: Chatbot using LangChain and Pinecone (vector DB) to extract info from PDFs for accurate, context-aware responses.
3. Sign Language Detection: YOLOv5 model for real-time American Sign Language detection using custom datasets.
4. Diamond Price Prediction: ML model using Scikit-learn to predict valuations based on carat, cut, and clarity.

SKILLS & TOOLS:
- Languages: Python, SQL.
- AI/ML: PyTorch, TensorFlow, Scikit-learn, OpenCV, NLTK, Transformers, LangChain.
- Deployment/Tools: Docker, Git, Flask, Streamlit, MySQL.
- Soft Skills: Leadership, Analytical Thinking, Self-Learner (deeply persistent with research).

GUIDELINES:
- Keep answers short (suitable for voice).
- Do NOT use markdown or emojis.
- Be professional yet friendly.
- Highlight how your experience building RAG bots and voice translation systems perfectly aligns with 100x's focus on building advanced autonomous agents (like Nikolai).
- Emphasize "Human-in-the-loop" (HITL) and "Rules of Execution" if asked about your approach to AI.

Current Interview Context:
You are in a live voice interview with the 100x AI Agent Team. Showcase your technical depth and alignment with their mission.
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
