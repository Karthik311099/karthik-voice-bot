import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Loader2, Trash2, Terminal, MessageSquare, History, X, Menu } from 'lucide-react';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
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
        
        if (finalTranscript) setTranscript(finalTranscript);
        else setTranscript(interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error !== 'no-speech') {
          setIsListening(false);
          setError(`Error: ${event.error}`);
        }
      };
    }
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const toggleListening = () => {
    if (synthRef.current.speaking) synthRef.current.cancel();

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      if (transcript.trim()) handleSendMessage(transcript);
    } else {
      setError(null);
      setTranscript('');
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        setIsListening(true);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setIsLoading(true);
    setTranscript('');

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

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex overflow-hidden">
      
      {/* Sidebar for History (Desktop) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <History size={20} className="text-indigo-400" />
              <span className="font-bold tracking-tight">Chat History</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-white">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {messages.filter(m => m.role === 'user').length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-sm">
                No recent conversations
              </div>
            ) : (
              messages.filter(m => m.role === 'user').map((msg, i) => (
                <div key={i} className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-xs text-slate-400 line-clamp-2 hover:bg-slate-800 transition-colors cursor-default">
                  {msg.content}
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-slate-800">
            <button 
              onClick={clearHistory}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20"
            >
              <Trash2 size={16} />
              <span className="text-sm font-semibold">Clear Session</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* Mobile Nav */}
        <nav className="lg:hidden p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400">
             <Menu size={24} />
           </button>
           <span className="font-bold">Karthik AI</span>
           <div className="w-10"></div>
        </nav>

        {/* Chat Wrapper (Centered) */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>

          <div className="w-full max-w-3xl h-full flex flex-col relative z-10">
            
            {/* Messages */}
            <main className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 scrollbar-hide">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                  <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 animate-bounce">
                    <Bot size={40} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">Hello, I'm Karthik's AI</h2>
                    <p className="text-slate-500 max-w-sm">Tap the microphone to start our conversation. I'm ready for your questions.</p>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`flex max-w-[85%] items-start space-x-4 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border border-slate-700'}`}>
                      {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-indigo-400" />}
                    </div>
                    <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-500/10' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-2xl'}`}>
                      <p className="text-sm sm:text-base leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none border border-slate-700/50 flex items-center space-x-3">
                    <Loader2 className="animate-spin text-indigo-400" size={18} />
                    <span className="text-xs text-slate-500 font-medium italic">Generating response...</span>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </main>

            {/* Input Controls */}
            <div className="p-8 sm:p-12">
               <div className="flex flex-col items-center space-y-6">
                  
                  {isListening && (
                    <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-4 rounded-2xl backdrop-blur-md animate-in slide-in-from-bottom-4">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="flex space-x-1">
                          {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-indigo-500 rounded-full animate-pulse"></div>)}
                        </div>
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Listening</span>
                      </div>
                      <p className="text-sm text-slate-300 italic line-clamp-2">
                        {transcript || "Speak now..."}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 transform active:scale-90 ${
                      isListening 
                        ? 'bg-red-500 shadow-[0_0_60px_rgba(239,68,68,0.4)] scale-110' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_60px_rgba(79,70,229,0.3)] hover:scale-105'
                    } disabled:opacity-50 disabled:grayscale`}
                  >
                    {isListening ? <MicOff size={44} className="text-white" /> : <Mic size={44} className="text-white" />}
                    {isListening && <div className="absolute inset-0 rounded-full border-4 border-red-400/30 animate-ping"></div>}
                  </button>

                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-600">
                      {isListening ? 'Click to process' : 'Click to talk'}
                    </p>
                    {error && <p className="text-[10px] text-red-400 bg-red-400/5 px-3 py-1 rounded-full border border-red-400/10">{error}</p>}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
