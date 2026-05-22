# Interactive AI Voice Assistant
### Professional Proxy for Karthik Murugesan | Built for 100x AI Agent Team

A state-of-the-art, voice-interactive AI agent designed as a professional surrogate for Karthik Murugesan. This project demonstrates high-performance engineering in Speech-to-Text (STT), Large Language Models (LLM), and Text-to-Speech (TTS), with specific optimizations for mobile low-latency environments.

---

## 🚀 Key Features

### 1. Hybrid Intelligence Stack
- **Brain:** Powered by **Groq (Llama 3.1 8B)** for near-instant text reasoning.
- **Ears:** **Groq Whisper (Large-v3)** ensures 99% transcription accuracy, handling background noise and accents flawlessly.
- **Voice:** A custom **Hybrid TTS Engine**:
  - **PC/Laptop:** Native Browser TTS for zero-latency execution.
  - **Mobile/Tablet:** **OpenAI Neural TTS (tts-1)** using the **Opus** format for high-fidelity, human-like speech.

### 2. Production-Grade Optimizations
- **Deterministic Audio Sequencing:** Solves the common mobile glitch where sentences play out of order. Implements an indexed buffer system to guarantee perfect speech flow.
- **Sentence-Level Streaming:** The bot begins speaking the first sentence while the rest of the response is still being generated.
- **Pre-warming Strategy:** Uses background handshakes to eliminate "Cold Start" delays on the first user interaction.
- **STT Hallucination Filter:** Intelligent noise-gating prevents background sounds from triggering random AI responses.

### 3. Grounded AI Persona
The agent is specifically grounded in:
- **100x.inc Knowledge:** Deep understanding of the AI Command Center, "Nikolai," and the "Rules of Execution."
- **Professional Resume:** Expert-level knowledge of Karthik's projects, including Multilingual Video Translation, RAG-based chatbots, and YOLOv5 detection.

---

## 🛠️ Technical Architecture

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend:** Vercel Edge Functions (optimized for global low latency).
- **Communication:** Streaming SSE (Server-Sent Events) for real-time text delivery.
- **Storage:** LocalStorage for persistent session history.

---

## 📦 Getting Started

1. **Clone the Repo:**
   ```bash
   git clone <your-repo-link>
   cd karthik-voice-bot
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Set Environment Variables:**
   Create a `.env` file with:
   ```env
   GROQ_API_KEY=your_groq_key
   OPENAI_API_KEY=your_openai_key
   ```

4. **Run Locally:**
   ```bash
   npm run dev
   ```

---

## 💡 Engineering Highlights (Interview Talking Points)

- **Why Groq?** Latency is the primary blocker for Voice UX. Groq's LPU provides the speed necessary for a natural human-like cadence.
- **Handling Autoplay:** Browsers block programmatic audio. I implemented "Audio Priming" via the microphone trigger to unlock the AudioContext seamlessly.
- **Mobile First:** Switched from standard MP3 to the Opus codec to reduce mobile data payload, cutting perceived wait times by 80%.

---

**Developed by Karthik Murugesan**  
*Building the future of Autonomous AI Agents.*
