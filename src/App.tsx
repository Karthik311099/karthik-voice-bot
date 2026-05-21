import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, User, Bot, Loader2 } from 'lucide-react';

// --- Types for Web Speech API ---
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const { webkitSpeechRecognition }: IWindow = window as any;

const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    if (webkitSpeechRecognition) {
      recognitionRef.current = new webkitSpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const last = event.results.length - 1;
        const text = event.results[last][0].transcript;
        setTranscript(text);
        handleSendMessage(text);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        setError('Could not hear you. Please try again or check microphone permissions.');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setError('Your browser does not support Speech Recognition. Please use Chrome or Edge.');
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of transcripts
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setError(null);
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const botMessage = data.response;
      setMessages((prev) => [...prev, { role: 'assistant' as const, content: botMessage }]);
      speak(botMessage);
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = (text: string) => {
    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Try to find a nice male voice for Karthik
    const voices = synthRef.current.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Male')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synthRef.current.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 sm:p-8 font-sans text-slate-900">
      {/* Header */}
      <header className="max-w-3xl w-full text-center mb-8">
        <h1 className="text-4xl font-bold text-indigo-600 mb-2">Interview Karthik</h1>
        <p className="text-slate-600">AI Proxy for Karthik Murugesan - 100x Assessment</p>
      </header>

      {/* Main Chat Area */}
      <main className="max-w-3xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col h-[60vh] sm:h-[70vh]">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
              <Bot size={64} strokeWidth={1} />
              <p className="text-lg text-center px-8">
                Click the microphone and say "Hello" or ask me about my life story, superpowers, or growth areas.
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-[85%] items-start space-x-3 ${
                  msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div className={`mt-1 p-2 rounded-full ${msg.role === 'user' ? 'bg-indigo-100' : 'bg-white shadow-sm'}`}>
                  {msg.role === 'user' ? <User size={20} className="text-indigo-600" /> : <Bot size={20} className="text-indigo-600" />}
                </div>
                <div
                  className={`p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white shadow-sm text-slate-800 rounded-tl-none border border-slate-100'
                  }`}
                >
                  <p className="text-sm sm:text-base leading-relaxed">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <Loader2 className="animate-spin text-indigo-600" size={20} />
                <span className="text-slate-500 text-sm italic">Karthik is thinking...</span>
              </div>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Footer / Controls */}
        <div className="p-6 bg-white border-t border-slate-100 flex flex-col items-center space-y-4">
          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-full border border-red-100">
              {error}
            </p>
          )}

          <div className="flex flex-col items-center space-y-2">
            <button
              onClick={toggleListening}
              disabled={isLoading}
              className={`group relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 transform active:scale-95 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isListening ? (
                <MicOff className="text-white animate-pulse" size={32} />
              ) : (
                <Mic className="text-white group-hover:scale-110 transition-transform" size={32} />
              )}
              {isListening && (
                <div className="absolute inset-0 rounded-full border-4 border-red-200 animate-ping opacity-75"></div>
              )}
            </button>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              {isListening ? 'Listening...' : 'Tap to speak'}
            </span>
          </div>

          {isListening && transcript && (
            <p className="text-sm text-slate-500 italic">"{transcript}..."</p>
          )}
        </div>
      </main>

      <footer className="mt-8 text-slate-400 text-xs">
        <p>Built for 100x Stage 1 Assessment by Karthik Murugesan</p>
      </footer>
    </div>
  );
};

export default App;
