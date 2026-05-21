import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Loader2, Trash2, History, X, Menu, Plus, MessageSquare } from 'lucide-react';

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
  // State
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentChat, setCurrentChat] = useState<Message[]>([]);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load History from LocalStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('karthik_chat_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

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

  // Save History to LocalStorage
  useEffect(() => {
    localStorage.setItem('karthik_chat_history', JSON.stringify(history));
  }, [history]);

  // Speech Recognition Setup
  useEffect(() => {
    if (webkitSpeechRecognition) {
      recognitionRef.current = new webkitSpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        setTranscript(final || interim);
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
    // If current chat has messages, save it to history if it's not already there
    if (currentChat.length > 0) {
      const existingSession = history.find(s => s.id === activeSessionId);
      if (!existingSession) {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: currentChat[0].content.slice(0, 30) + '...',
          messages: currentChat,
          timestamp: Date.now()
        };
        setHistory([newSession, ...history]);
      } else {
        // Update existing session
        setHistory(history.map(s => s.id === activeSessionId ? { ...s, messages: currentChat } : s));
      }
    }
    
    // Reset for new chat
    setCurrentChat([]);
    setActiveSessionId(null);
    setTranscript('');
    setError(null);
    synthRef.current.cancel();
  };

  const loadSession = (session: ChatSession) => {
    // Save current if needed
    if (currentChat.length > 0 && !activeSessionId) {
       const newSession: ChatSession = {
          id: Date.now().toString(),
          title: currentChat[0].content.slice(0, 30) + '...',
          messages: currentChat,
          timestamp: Date.now()
        };
        setHistory([newSession, ...history]);
    }

    setCurrentChat(session.messages);
    setActiveSessionId(session.id);
    setIsSidebarOpen(false);
    synthRef.current.cancel();
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory(history.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setCurrentChat([]);
      setActiveSessionId(null);
    }
  };

  const clearCurrentChat = () => {
    setCurrentChat([]);
    setTranscript('');
    synthRef.current.cancel();
  };

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
      
      // Auto-save/update session in history
      if (activeSessionId) {
        setHistory(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: updatedMessages } : s));
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
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans flex overflow-hidden">
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-800">
            <button 
              onClick={startNewChat}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 font-bold"
            >
              <Plus size={18} />
              <span>New Conversation</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-4 px-2">History</h3>
            {history.length === 0 ? (
              <div className="text-center py-10 text-slate-600 text-sm italic">No saved chats</div>
            ) : (
              history.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => loadSession(session)}
                  className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${activeSessionId === session.id ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-800/30 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <MessageSquare size={14} className="shrink-0" />
                    <span className="text-xs truncate font-medium">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-slate-900/80 backdrop-blur-md border-t border-slate-800">
             <div className="flex items-center space-x-3 px-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold">KM</div>
                <div className="overflow-hidden">
                  <p className="text-xs font-bold truncate">Karthik Murugesan</p>
                  <p className="text-[9px] text-slate-500">AI Agent Candidate</p>
                </div>
             </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* Header */}
        <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50 backdrop-blur-xl z-20">
           <div className="flex items-center space-x-4">
             <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:text-white">
               <Menu size={24} />
             </button>
             <h2 className="font-bold text-slate-200 hidden sm:block">
               {activeSessionId ? "Viewing History" : "Active Conversation"}
             </h2>
           </div>
           
           <div className="flex items-center space-x-2">
             <button 
               onClick={clearCurrentChat}
               className="flex items-center space-x-2 py-2 px-4 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
             >
               <Trash2 size={14} />
               <span>Clear Chat</span>
             </button>
           </div>
        </header>

        {/* Chat Container */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 blur-[150px] rounded-full"></div>
          </div>

          <div className="w-full max-w-4xl h-full flex flex-col relative z-10">
            
            <main className="flex-1 overflow-y-auto p-6 sm:p-12 space-y-10 scrollbar-hide">
              {currentChat.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-600 blur-3xl opacity-20 animate-pulse"></div>
                    <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-500/20 relative rotate-6">
                      <Bot size={48} className="text-white -rotate-6" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-white mb-4 tracking-tight">Karthik's AI Surrogate</h2>
                    <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                      This bot knows my story, my superpowers, and my goals. <br/>
                      <span className="text-indigo-400 font-bold">Tap the mic to start interviewing me.</span>
                    </p>
                  </div>
                </div>
              )}

              {currentChat.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-300`}>
                  <div className={`flex max-w-[85%] sm:max-w-[70%] items-start space-x-5 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-slate-700 shadow-xl'}`}>
                      {msg.role === 'user' ? <User size={20} className="text-white" /> : <Bot size={20} className="text-indigo-400" />}
                    </div>
                    <div className={`p-5 rounded-3xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-2xl shadow-indigo-500/20' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-2xl'}`}>
                      <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/50 backdrop-blur-md p-5 rounded-3xl rounded-tl-none border border-slate-700/50 flex items-center space-x-4">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                      <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Processing AI</span>
                  </div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </main>

            {/* Mic Control */}
            <div className="p-8 sm:p-16 relative">
               
               {isListening && (
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full w-full max-w-lg p-6 flex flex-col items-center">
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-6 rounded-[2rem] shadow-2xl w-full text-center space-y-4 animate-in slide-in-from-bottom-8">
                       <div className="flex items-center justify-center space-x-2">
                         {[...Array(6)].map((_, i) => (
                           <div key={i} className="w-1.5 bg-indigo-500 rounded-full animate-pulse" style={{ height: `${Math.random() * 20 + 10}px` }}></div>
                         ))}
                       </div>
                       <p className="text-indigo-400 text-sm font-bold italic tracking-tight">
                         "{transcript || "Listening to you..."}"
                       </p>
                    </div>
                 </div>
               )}

               <div className="flex flex-col items-center space-y-6">
                  <button
                    onClick={toggleListening}
                    disabled={isLoading}
                    className={`w-32 h-32 rounded-[3rem] flex items-center justify-center transition-all duration-500 transform active:scale-90 ${
                      isListening 
                        ? 'bg-red-500 shadow-[0_0_80px_rgba(239,68,68,0.5)] scale-110 rotate-12' 
                        : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_80px_rgba(79,70,229,0.4)] hover:scale-105'
                    } disabled:opacity-50 disabled:grayscale`}
                  >
                    {isListening ? <MicOff size={56} className="text-white" /> : <Mic size={56} className="text-white" />}
                    {isListening && <div className="absolute inset-0 rounded-[3rem] border-8 border-red-400/20 animate-ping"></div>}
                  </button>

                  <div className="text-center">
                    <p className="text-[10px] uppercase font-black tracking-[0.5em] text-slate-700">
                      {isListening ? 'Stop & Process' : 'Click to Speak'}
                    </p>
                    {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
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
