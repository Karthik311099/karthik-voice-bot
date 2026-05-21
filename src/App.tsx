import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Loader2, Trash2, X, Menu, Plus, MessageSquare, History as HistoryIcon, ChevronLeft, ChevronRight } from 'lucide-react';

// --- Types ---
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const { webkitSpeechRecognition }: IWindow = window as any;

const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentChat, setCurrentChat] = useState<Message[]>([]);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default open on PC

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const savedHistory = localStorage.getItem('karthik_chat_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const loadVoices = () => {
      const voices = synthRef.current.getVoices();
      // Expanded male voice search for cross-platform consistency
      const voice = voices.find(v => 
        (v.name.includes('Male') || v.name.includes('David') || v.name.includes('James') || v.name.includes('Guy') || v.name.includes('Stefan')) && 
        (v.lang.startsWith('en'))
      ) || voices.find(v => v.name.includes('Google US English') && v.name.includes('Male')) 
        || voices.find(v => v.lang.startsWith('en-US')) 
        || voices[0];
      
      if (voice) setSelectedVoice(voice);
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('karthik_chat_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (webkitSpeechRecognition) {
      recognitionRef.current = new webkitSpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscriptRef.current += event.results[i][0].transcript + ' ';
          else interim += event.results[i][0].transcript;
        }
        setTranscript(finalTranscriptRef.current + interim);
      };

      recognitionRef.current.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          setIsListening(false);
          setError(`Mic Error: ${event.error}`);
        }
      };
    }
    
    // Close sidebar by default on small screens
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat, isLoading]);

  const startNewChat = () => {
    synthRef.current.cancel();
    if (currentChat.length > 0) saveCurrentToHistory();
    setCurrentChat([]);
    setActiveSessionId(null);
    setTranscript('');
    finalTranscriptRef.current = '';
    setError(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const saveCurrentToHistory = () => {
    if (currentChat.length === 0) return;
    const existing = history.find(s => s.id === activeSessionId);
    if (!existing) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: currentChat[0].content.slice(0, 35) + '...',
        messages: currentChat,
        timestamp: Date.now()
      };
      setHistory([newSession, ...history]);
      setActiveSessionId(newSession.id);
    } else {
      setHistory(history.map(s => s.id === activeSessionId ? { ...s, messages: currentChat } : s));
    }
  };

  const loadSession = (session: ChatSession) => {
    synthRef.current.cancel();
    if (currentChat.length > 0 && !activeSessionId) saveCurrentToHistory();
    setCurrentChat(session.messages);
    setActiveSessionId(session.id);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    synthRef.current.cancel();
    setHistory(history.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setCurrentChat([]);
      setActiveSessionId(null);
    }
  };

  const toggleListening = () => {
    if (synthRef.current.speaking) synthRef.current.cancel();

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      const textToSend = transcript.trim();
      if (textToSend) handleSendMessage(textToSend);
      finalTranscriptRef.current = '';
    } else {
      setError(null);
      setTranscript('');
      finalTranscriptRef.current = '';
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        setIsListening(true);
      }
    }
  };

  const handleSendMessage = async (text: string) => {
    const newMessages: Message[] = [...currentChat, { role: 'user', content: text }];
    setCurrentChat(newMessages);
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
      const updatedMessages: Message[] = [...newMessages, { role: 'assistant', content: botMessage }];
      setCurrentChat(updatedMessages);
      
      if (activeSessionId) {
        setHistory(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updatedMessages } : s));
      } else {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: text.slice(0, 35) + '...',
          messages: updatedMessages,
          timestamp: Date.now()
        };
        setHistory([newSession, ...history]);
        setActiveSessionId(newSession.id);
      }
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

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex relative overflow-hidden">
      
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-80 bg-slate-900 border-r border-slate-800 transition-all duration-300 ease-in-out lg:relative ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:w-0 lg:border-none'}`}>
        <div className="flex flex-col h-full w-80">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tighter text-white">Chat History</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-white bg-slate-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <button 
              onClick={startNewChat}
              className="w-full flex items-center justify-center space-x-2 py-4 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-all shadow-xl shadow-indigo-500/10 font-bold mb-6"
            >
              <Plus size={20} />
              <span>New Conversation</span>
            </button>

            {history.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-sm italic">No history yet</div>
            ) : (
              history.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => loadSession(session)}
                  className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${activeSessionId === session.id ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-800/20 border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden pr-8">
                    <MessageSquare size={16} className="shrink-0 opacity-60" />
                    <span className="text-xs truncate font-semibold">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="absolute right-3 p-2 lg:opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all text-slate-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
          
          <div className="p-6 border-t border-slate-800 bg-slate-900/50">
             <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-xs font-black shadow-lg shadow-indigo-500/20">KM</div>
                <div>
                  <p className="text-xs font-black text-white">Karthik Murugesan</p>
                  <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Candidate</p>
                </div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col relative min-w-0 bg-[#020617]">
        
        {/* Top Header */}
        <header className="h-20 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/20 backdrop-blur-2xl z-30">
           <div className="flex items-center space-x-4">
             {!isSidebarOpen && (
               <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-slate-400 hover:text-white bg-slate-900 rounded-xl transition-all">
                 <Menu size={24} />
               </button>
             )}
             <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg lg:hidden flex items-center justify-center">
                  <Bot size={20} className="text-white" />
                </div>
                <h1 className="text-xl font-black text-white lg:text-slate-400">Karthik AI</h1>
             </div>
           </div>

           <div className="flex items-center space-x-4">
              <button 
                onClick={() => setCurrentChat([])}
                className="flex items-center space-x-2 py-2 px-4 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors bg-slate-900/50 rounded-lg border border-slate-800"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
           </div>
        </header>

        {/* Chat Content (Centered) */}
        <div className="flex-1 overflow-hidden flex flex-col items-center">
          <div className="w-full max-w-4xl h-full flex flex-col items-center">
            
            <main className="w-full flex-1 overflow-y-auto px-6 py-10 space-y-10 scrollbar-hide">
              {currentChat.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-10 animate-in fade-in duration-1000">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-600 blur-[120px] opacity-10 animate-pulse"></div>
                    <div className="w-36 h-36 bg-slate-900 border border-slate-800 rounded-[3.5rem] flex items-center justify-center shadow-2xl relative">
                       <Bot size={72} className="text-indigo-500" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h2 className="text-5xl font-black text-white tracking-tighter sm:text-6xl">Let's talk.</h2>
                    <p className="text-slate-500 text-lg max-w-md mx-auto leading-relaxed">
                      I'm Karthik's voice proxy. Ask me anything about his skills, projects, or background.
                    </p>
                  </div>
                </div>
              )}

              <div className="w-full max-w-3xl mx-auto space-y-10">
                {currentChat.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-6 duration-500`}>
                    <div className={`flex max-w-[90%] sm:max-w-[85%] items-start space-x-5 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-400 shadow-xl shadow-indigo-600/20' : 'bg-slate-900 border-slate-800 shadow-2xl'}`}>
                        {msg.role === 'user' ? <User size={20} className="text-white" /> : <Bot size={20} className="text-indigo-400" />}
                      </div>
                      <div className={`p-6 rounded-3xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-2xl shadow-indigo-600/10' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800 shadow-2xl'}`}>
                        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900/50 backdrop-blur-md p-6 rounded-3xl rounded-tl-none border border-slate-800 flex items-center space-x-4 shadow-2xl">
                      <div className="flex space-x-2">
                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce"></div>
                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                        <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </main>

            {/* Input Section */}
            <div className="w-full px-6 py-10 sm:py-16 flex flex-col items-center relative z-20">
               
               {isListening && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-full max-w-xl px-6">
                    <div className="bg-slate-900/95 backdrop-blur-3xl border border-slate-800 p-8 rounded-[3rem] shadow-[0_40px_120px_rgba(0,0,0,0.9)] text-center space-y-6 animate-in slide-in-from-bottom-12 duration-500">
                       <div className="flex items-center justify-center space-x-3">
                         {[...Array(15)].map((_, i) => (
                           <div key={i} className="w-1.5 bg-indigo-500 rounded-full animate-shimmer" style={{ height: `${Math.random() * 40 + 10}px`, animationDelay: `${i * 0.05}s` }}></div>
                         ))}
                       </div>
                       <p className="text-indigo-400 text-lg font-black italic tracking-tight leading-snug">
                         {transcript || "Listening carefully..."}
                       </p>
                    </div>
                 </div>
               )}

               <div className="flex flex-col items-center space-y-6">
                  <button
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`w-36 h-36 rounded-[4rem] flex items-center justify-center transition-all duration-700 transform active:scale-90 ${
                      isListening 
                        ? 'bg-red-500 shadow-[0_0_120px_rgba(239,68,68,0.4)] scale-110' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_120px_rgba(79,70,229,0.4)] hover:scale-105'
                    } disabled:opacity-50 disabled:grayscale`}
                  >
                    {isListening ? <MicOff size={64} className="text-white" /> : <Mic size={64} className="text-white" />}
                    {isListening && <div className="absolute inset-0 rounded-[4rem] border-8 border-red-500/10 animate-ping"></div>}
                  </button>

                  <div className="text-center space-y-2">
                    <p className="text-[12px] font-black uppercase tracking-[0.8em] text-slate-700">
                      {isListening ? 'Stop' : 'Talk'}
                    </p>
                    {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%, 100% { height: 12px; opacity: 0.3; } 50% { height: 48px; opacity: 1; } }
        .animate-shimmer { animation: shimmer 1s infinite ease-in-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
