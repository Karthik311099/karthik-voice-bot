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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

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
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        // This pattern prevents the "repeating words" bug by separating final and interim
        setTranscript(finalTranscript || interimTranscript);
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
  };

  const toggleListening = () => {
    if (synthRef.current.speaking) synthRef.current.cancel();

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      const textToSend = transcript.trim();
      if (textToSend) handleSendMessage(textToSend);
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
    <div className="h-screen w-full bg-[#020617] text-slate-200 font-sans flex relative overflow-hidden">
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">History</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500 hover:text-white bg-slate-800 rounded-lg">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <button 
              onClick={startNewChat}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/10 font-bold mb-6"
            >
              <Plus size={18} />
              <span>New Chat</span>
            </button>

            {history.length === 0 ? (
              <div className="text-center py-20 text-slate-600 text-sm italic">No history yet</div>
            ) : (
              history.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => loadSession(session)}
                  className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${activeSessionId === session.id ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-800/20 border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                >
                  <div className="flex items-center space-x-3 overflow-hidden pr-8">
                    <MessageSquare size={16} className="shrink-0 opacity-60" />
                    <span className="text-xs truncate font-medium">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="absolute right-2 p-2 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all text-slate-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/20 backdrop-blur-xl z-30">
           <div className="flex items-center space-x-4">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white bg-slate-900 rounded-lg transition-all">
               <Menu size={20} />
             </button>
             <h1 className="text-lg font-bold text-white">Karthik AI</h1>
           </div>

           <div className="flex items-center space-x-2">
              <button 
                onClick={clearCurrentChat}
                className="flex items-center space-x-2 py-2 px-3 text-xs font-semibold text-slate-500 hover:text-red-400 transition-colors bg-slate-900/50 rounded-lg border border-slate-800"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Clear Chat</span>
              </button>
           </div>
        </header>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden flex flex-col items-center">
          <div className="w-full h-full flex flex-col items-center">
            
            <main className="w-full flex-1 overflow-y-auto px-4 py-8 space-y-6 scrollbar-hide">
              {currentChat.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in duration-700">
                  <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                    <Bot size={40} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Karthik's Voice Proxy</h2>
                    <p className="text-slate-500 max-w-sm mx-auto text-sm leading-relaxed">
                      I'm ready for your questions. Tap the mic to begin.
                    </p>
                  </div>
                </div>
              )}

              <div className="w-full max-w-4xl mx-auto space-y-6">
                {currentChat.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`flex max-w-[90%] sm:max-w-[80%] items-start space-x-4 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${msg.role === 'user' ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-slate-900 border-slate-800 shadow-xl'}`}>
                        {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-indigo-400" />}
                      </div>
                      <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800 shadow-2xl'}`}>
                        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-2xl rounded-tl-none border border-slate-800 flex items-center space-x-3">
                      <Loader2 className="animate-spin text-indigo-400" size={16} />
                      <span className="text-xs text-slate-500 italic">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </main>

            {/* Mic Section */}
            <div className="w-full px-6 py-8 flex flex-col items-center bg-slate-950/40 backdrop-blur-xl border-t border-slate-800">
               
               {isListening && (
                 <div className="w-full max-w-md p-4 bg-slate-900 border border-slate-800 rounded-2xl mb-6 shadow-2xl animate-in slide-in-from-bottom-4">
                   <div className="flex items-center space-x-2 mb-2">
                     <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                     <span className="text-[10px] uppercase font-bold text-red-500 tracking-wider">Listening</span>
                   </div>
                   <p className="text-sm text-slate-400 italic">
                     {transcript || "..."}
                   </p>
                 </div>
               )}

               <button
                onClick={toggleListening}
                disabled={isLoading}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform active:scale-90 ${
                  isListening 
                    ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)] scale-110' 
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:scale-105'
                } disabled:opacity-50`}
              >
                {isListening ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-white" />}
              </button>

              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600 mt-4">
                {isListening ? 'Tap to finish' : 'Tap to speak'}
              </p>
              {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
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
