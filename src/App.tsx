import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Loader2, Trash2, X, Menu, Plus, MessageSquare, History as HistoryIcon } from 'lucide-react';

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Collapsed by default

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const savedHistory = localStorage.getItem('karthik_chat_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const loadVoices = () => {
      const voices = synthRef.current.getVoices();
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
    setIsSidebarOpen(false);
  };

  const saveCurrentToHistory = () => {
    if (currentChat.length === 0) return;
    const existing = history.find(s => s.id === activeSessionId);
    if (!existing) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: currentChat[0].content.slice(0, 40) + '...',
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
    setIsSidebarOpen(false);
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

  const clearCurrentChat = () => {
    synthRef.current.cancel();
    setCurrentChat([]);
    setTranscript('');
    finalTranscriptRef.current = '';
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
          title: text.slice(0, 40) + '...',
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
    <div className="h-screen w-full bg-[#020617] text-slate-200 font-sans flex relative overflow-hidden text-lg">
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar (Full screen on mobile, drawer on PC) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-full sm:w-96 bg-slate-900 border-r border-slate-800 transition-transform duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-3xl font-black tracking-tighter text-white">History</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-3 text-slate-500 hover:text-white bg-slate-800 rounded-2xl">
              <X size={28} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <button 
              onClick={startNewChat}
              className="w-full flex items-center justify-center space-x-3 py-5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] transition-all shadow-2xl shadow-indigo-500/20 font-black text-xl mb-10"
            >
              <Plus size={24} />
              <span>New Conversation</span>
            </button>

            {history.length === 0 ? (
              <div className="text-center py-20 text-slate-600 italic">No saved chats</div>
            ) : (
              history.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => loadSession(session)}
                  className={`group relative flex items-center justify-between p-6 rounded-[1.5rem] border transition-all cursor-pointer ${activeSessionId === session.id ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400' : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}
                >
                  <div className="flex items-center space-x-4 overflow-hidden pr-10">
                    <MessageSquare size={20} className="shrink-0 opacity-60" />
                    <span className="text-sm truncate font-bold">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="absolute right-4 p-3 hover:bg-red-500/20 hover:text-red-400 rounded-xl transition-all text-slate-600"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel (Always Full Screen) */}
      <div className="flex-1 flex flex-col relative w-full h-full bg-[#020617]">
        
        {/* Top Header */}
        <header className="h-24 border-b border-slate-800/50 flex items-center justify-between px-8 bg-slate-950/20 backdrop-blur-3xl z-30">
           <div className="flex items-center space-x-6">
             <button onClick={() => setIsSidebarOpen(true)} className="p-4 text-slate-400 hover:text-white bg-slate-900/50 rounded-2xl transition-all border border-slate-800">
               <Menu size={32} />
             </button>
             <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                  <Bot size={28} className="text-white" />
                </div>
                <h1 className="text-3xl font-black text-white tracking-tighter">Karthik AI</h1>
             </div>
           </div>

           <div className="flex items-center space-x-4">
              <button 
                onClick={clearCurrentChat}
                className="flex items-center space-x-3 py-3 px-6 text-sm font-black text-slate-500 hover:text-red-400 transition-colors bg-slate-900/30 rounded-xl border border-slate-800"
              >
                <Trash2 size={20} />
                <span className="hidden sm:inline uppercase tracking-widest">Reset Chat</span>
              </button>
           </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden flex flex-col items-center relative">
          
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-indigo-500/5 blur-[180px] rounded-full"></div>
          </div>

          <div className="w-full max-w-5xl h-full flex flex-col relative z-10">
            
            <main className="flex-1 overflow-y-auto px-8 py-12 space-y-12 scrollbar-hide">
              {currentChat.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-12 animate-in fade-in duration-1000">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-600 blur-[120px] opacity-20 animate-pulse"></div>
                    <div className="w-44 h-44 bg-slate-900 border-2 border-slate-800 rounded-[4rem] flex items-center justify-center shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative">
                       <Bot size={80} className="text-indigo-500" />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h2 className="text-6xl sm:text-7xl font-black text-white tracking-tighter">I'm Listening.</h2>
                    <p className="text-slate-500 text-xl max-w-2xl mx-auto leading-relaxed font-medium">
                      Ask me anything. I know Karthik's background, skills, and goals.
                    </p>
                  </div>
                </div>
              )}

              <div className="w-full max-w-4xl mx-auto space-y-12">
                {currentChat.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-8 duration-500`}>
                    <div className={`flex max-w-[95%] sm:max-w-[85%] items-start space-x-6 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-400 shadow-2xl shadow-indigo-600/30' : 'bg-slate-900 border-slate-800 shadow-2xl'}`}>
                        {msg.role === 'user' ? <User size={24} className="text-white" /> : <Bot size={24} className="text-indigo-400" />}
                      </div>
                      <div className={`p-8 rounded-[2.5rem] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-2xl shadow-indigo-600/20' : 'bg-slate-900 text-slate-100 rounded-tl-none border border-slate-800 shadow-[0_20px_60px_rgba(0,0,0,0.4)]'}`}>
                        <p className="text-lg sm:text-xl leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900/60 backdrop-blur-2xl p-8 rounded-[2.5rem] rounded-tl-none border border-slate-800 flex items-center space-x-6 shadow-2xl">
                      <div className="flex space-x-3">
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"></div>
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                        <div className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">AI Thinking</span>
                    </div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </main>

            {/* Bottom Controls */}
            <div className="px-8 py-12 sm:py-20 flex flex-col items-center relative z-40 bg-gradient-to-t from-[#020617] via-[#020617] to-transparent">
               
               {isListening && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-full max-w-3xl px-8 pb-10">
                    <div className="bg-slate-900/95 backdrop-blur-3xl border-2 border-slate-800 p-10 rounded-[4rem] shadow-[0_50px_150px_rgba(0,0,0,1)] text-center space-y-8 animate-in slide-in-from-bottom-12 duration-500">
                       <div className="flex items-center justify-center space-x-4">
                         {[...Array(20)].map((_, i) => (
                           <div key={i} className="w-1.5 bg-indigo-500 rounded-full animate-shimmer" style={{ height: `${Math.random() * 50 + 20}px`, animationDelay: `${i * 0.05}s` }}></div>
                         ))}
                       </div>
                       <p className="text-indigo-400 text-2xl font-black italic tracking-tight leading-snug">
                         {transcript || "Speak clearly..."}
                       </p>
                    </div>
                 </div>
               )}

               <div className="flex flex-col items-center space-y-8">
                  <button
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`w-40 h-40 rounded-[5rem] flex items-center justify-center transition-all duration-700 transform active:scale-90 ${
                      isListening 
                        ? 'bg-red-500 shadow-[0_0_150px_rgba(239,68,68,0.5)] scale-110' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_150px_rgba(79,70,229,0.4)] hover:scale-105'
                    } disabled:opacity-50 disabled:grayscale`}
                  >
                    {isListening ? <MicOff size={80} className="text-white" /> : <Mic size={80} className="text-white" />}
                    {isListening && <div className="absolute inset-0 rounded-[5rem] border-[12px] border-red-500/10 animate-ping"></div>}
                  </button>

                  <div className="text-center space-y-3">
                    <p className="text-sm font-black uppercase tracking-[1em] text-slate-700">
                      {isListening ? 'Stop Recording' : 'Push to Talk'}
                    </p>
                    {error && <p className="text-sm text-red-500 font-black">{error}</p>}
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%, 100% { height: 15px; opacity: 0.3; } 50% { height: 60px; opacity: 1; } }
        .animate-shimmer { animation: shimmer 0.8s infinite ease-in-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;
