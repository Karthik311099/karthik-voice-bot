import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Loader2, Trash2, Terminal } from 'lucide-react';

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
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadVoices = () => {
      const voices = synthRef.current.getVoices();
      const voice = voices.find(v => 
        (v.name.includes('Google') || v.name.includes('Natural')) && 
        (v.name.includes('Male') || v.name.includes('David') || v.name.includes('James'))
      ) || voices.find(v => v.lang.startsWith('en-US')) || voices[0];
      
      if (voice) setSelectedVoice(voice);
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    // Initialize Speech Recognition
    if (webkitSpeechRecognition) {
      recognitionRef.current = new webkitSpeechRecognition();
      recognitionRef.current.continuous = true; // Changed to true for manual stop
      recognitionRef.current.interimResults = true; // Show results as they come
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscript(finalTranscript);
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
          setError(`Error: ${event.error}. Please check mic permissions.`);
        }
      };

      recognitionRef.current.onend = () => {
        // We handle stopping manually, but this ensures state is clean
      };
    } else {
      setError('Your browser does not support Speech Recognition. Please use Chrome.');
    }
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const toggleListening = () => {
    // 1. Stop any current speaking immediately
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
    }

    if (isListening) {
      // STOP LISTENING & SEND
      recognitionRef.current?.stop();
      setIsListening(false);
      if (transcript.trim()) {
        handleSendMessage(transcript);
      }
    } else {
      // START LISTENING
      setError(null);
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
        // If already started, just reset state
        setIsListening(true);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setIsLoading(true);
    setTranscript(''); // Clear transcript after sending

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
      setError('API Error: ' + err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const speak = (text: string) => {
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synthRef.current.speak(utterance);
  };

  const clearHistory = () => {
    synthRef.current.cancel();
    setMessages([]);
    setTranscript('');
    setError(null);
  };

  const downloadHistory = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(messages, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "conversation_history.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-0 sm:p-4 font-sans text-slate-200 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
      </div>

      <div className="relative z-10 w-full max-w-5xl h-screen sm:h-[90vh] flex flex-col bg-slate-900/50 sm:rounded-3xl border border-slate-800 backdrop-blur-xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Karthik AI
              </h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Voice Proxy v2.0</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={downloadHistory}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Download JSON History"
            >
              <Terminal size={20} />
            </button>
            <button 
              onClick={clearHistory}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              title="Clear Conversation"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 scrollbar-hide">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-6 animate-in fade-in duration-700">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse"></div>
                <Bot size={80} strokeWidth={1} className="relative text-indigo-400" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-2xl font-semibold text-white mb-2">Ready for Interview</h2>
                <p className="text-slate-400 leading-relaxed">
                  Tap the microphone to start speaking. I'll listen until you tap it again to process your question.
                </p>
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-300`}
            >
              <div
                className={`flex max-w-[90%] sm:max-w-[80%] items-start space-x-3 ${
                  msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div className={`mt-1 p-2 rounded-xl shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                  {msg.role === 'user' ? <User size={18} className="text-white" /> : <Bot size={18} className="text-indigo-400" />}
                </div>
                <div
                  className={`p-4 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-xl'
                  }`}
                >
                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-pulse">
              <div className="flex items-center space-x-3 bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                </div>
                <span className="text-slate-400 text-xs font-medium italic">Karthik is replying...</span>
              </div>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </main>

        {/* Control Center */}
        <div className="p-6 sm:p-10 bg-slate-900/90 border-t border-slate-800 relative">
          
          {/* Waveform/Transcript Preview */}
          <div className="absolute top-0 left-0 w-full -translate-y-full px-6 py-4 bg-gradient-to-t from-slate-900 to-transparent">
            {isListening && (
              <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center space-x-1">
                   {[...Array(8)].map((_, i) => (
                     <div 
                      key={i} 
                      className="w-1 bg-indigo-500 rounded-full animate-shimmer"
                      style={{ 
                        height: `${Math.random() * 20 + 10}px`,
                        animationDuration: `${Math.random() * 0.5 + 0.5}s`
                      }}
                    ></div>
                   ))}
                </div>
                <p className="text-indigo-400 text-sm font-medium animate-pulse italic">
                  {transcript || "Listening for your voice..."}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center space-y-6">
            {error && (
              <p className="text-red-400 text-xs bg-red-400/10 px-4 py-2 rounded-full border border-red-400/20">
                {error}
              </p>
            )}

            <div className="flex items-center space-x-8">
               <button
                onClick={toggleListening}
                disabled={isLoading}
                className={`group relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500 transform ${
                  isListening
                    ? 'bg-red-500 shadow-[0_0_50px_rgba(239,68,68,0.4)] scale-110'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_50px_rgba(79,70,229,0.3)] hover:scale-105'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isListening ? (
                  <MicOff className="text-white" size={40} />
                ) : (
                  <Mic className="text-white" size={40} />
                )}
                
                {isListening && (
                  <div className="absolute inset-0 rounded-full border-8 border-red-400/30 animate-ping"></div>
                )}
              </button>
            </div>
            
            <div className="text-center">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
                {isListening ? 'Tap to finish speaking' : 'Tap to start speaking'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%, 100% { height: 10px; opacity: 0.5; }
          50% { height: 30px; opacity: 1; }
        }
        .animate-shimmer {
          animation: shimmer infinite ease-in-out;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;
