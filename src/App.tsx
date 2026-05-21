import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Loader2, Trash2, X, Menu, Plus, MessageSquare } from 'lucide-react';

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

const App: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [currentChat, setCurrentChat] = useState<Message[]>([]);
  const [history, setHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load History & Hardened Voice Search
  useEffect(() => {
    const savedHistory = localStorage.getItem('karthik_chat_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const findBestMaleVoice = () => {
      const voices = synthRef.current.getVoices();
      
      // 1. Prioritize known high-quality "David" or "James" (PC/Windows)
      // 2. Prioritize "Male" keyword
      // 3. Prioritize "Google" or "Natural" male voices (Mobile/Android)
      // 4. Fallback to any English male-ish sounding voice
      const maleVoice = voices.find(v => 
        (v.name.includes('David') || v.name.includes('James') || v.name.includes('Male')) && 
        v.lang.startsWith('en')
      ) || voices.find(v => 
        (v.name.includes('Google UK English M') || v.name.includes('Guy') || v.name.includes('Stefan')) && 
        v.lang.startsWith('en')
      ) || voices.find(v => v.lang.startsWith('en-US')) || voices[0];
      
      if (maleVoice) setSelectedVoice(maleVoice);
    };

    findBestMaleVoice();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = findBestMaleVoice;
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('karthik_chat_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat, isLoading]);

  const startRecording = async () => {
    try {
      synthRef.current.cancel();
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await handleTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start(1000); 
      setIsListening(true);
    } catch (err: any) {
      setError('Mic Error: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
    }
  };

  const handleTranscription = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', blob);
      const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (data.text?.trim()) await handleSendMessage(data.text);
      else setError('No speech detected.');
    } catch (err: any) {
      setError('Transcription failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const newMessages: Message[] = [...currentChat, { role: 'user', content: text }];
    setCurrentChat(newMessages);
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
      const finalMessages: Message[] = [...newMessages, { role: 'assistant', content: botMessage }];
      setCurrentChat(finalMessages);
      
      if (activeSessionId) {
        setHistory(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: finalMessages } : s));
      } else {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: text.slice(0, 30) + '...',
          messages: finalMessages,
          timestamp: Date.now()
        };
        setHistory(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
      speak(botMessage);
    } catch (err: any) {
      setError('AI Error: ' + err.message);
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

  const startNewChat = () => {
    synthRef.current.cancel();
    setCurrentChat([]);
    setActiveSessionId(null);
    setIsSidebarOpen(false);
    setError(null);
  };

  const loadSession = (session: ChatSession) => {
    synthRef.current.cancel();
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

  return (
    <div className="fixed inset-0 bg-[#020617] text-slate-200 font-sans flex overflow-hidden w-full h-full">
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-full sm:w-80 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold">History</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"><X size={24} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <button onClick={startNewChat} className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-bold mb-4 shadow-lg">
              <Plus size={20} />
              <span>New Chat</span>
            </button>
            {history.map((s) => (
              <div key={s.id} onClick={() => loadSession(s)} className={`group relative flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${activeSessionId === s.id ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-800/30 border-transparent text-slate-400'}`}>
                <div className="flex items-center space-x-3 overflow-hidden pr-8">
                  <MessageSquare size={16} className="shrink-0 opacity-50" />
                  <span className="text-xs truncate font-medium">{s.title}</span>
                </div>
                <button onClick={(e) => deleteSession(e, s.id)} className="absolute right-2 p-2 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col w-full h-full relative">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/20 backdrop-blur-md z-30">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg"><Menu size={24} /></button>
            <h1 className="text-lg font-bold text-white tracking-tight uppercase">Karthik AI</h1>
          </div>
          <button onClick={() => { synthRef.current.cancel(); setCurrentChat([]); }} className="p-2 text-slate-500 hover:text-red-400"><Trash2 size={20} /></button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center">
          <div className="w-full max-w-4xl space-y-6">
            {currentChat.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse"><Bot size={32} className="text-white" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Karthik's AI Proxy</h2>
                  <p className="text-slate-500 text-sm mt-2">Speak to me. I'm ready.</p>
                </div>
              </div>
            )}

            {currentChat.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`flex max-w-[90%] sm:max-w-[80%] items-start space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border border-slate-700'}`}>
                    {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-indigo-400" />}
                  </div>
                  <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-xl' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-2xl'}`}>
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center space-x-3">
                  <Loader2 className="animate-spin text-indigo-400" size={16} />
                  <span className="text-xs text-slate-500 font-medium italic">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </main>

        <div className="p-6 bg-slate-950/40 backdrop-blur-xl border-t border-slate-800 flex flex-col items-center">
          {isListening && (
            <div className="w-full max-w-md p-4 bg-slate-900 border border-slate-800 rounded-xl mb-6 text-center animate-in slide-in-from-bottom-2">
               <div className="flex items-center justify-center space-x-3 mb-2">
                 <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                 <p className="text-xs text-red-500 font-bold uppercase tracking-widest">Recording Audio</p>
               </div>
               <p className="text-sm text-slate-400">Recording continues even if you pause. Tap to finish.</p>
            </div>
          )}

          <button onClick={isListening ? stopRecording : startRecording} disabled={isLoading} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${isListening ? 'bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.4)]' : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.3)]'}`}>
            {isListening ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-white" />}
          </button>
          
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4">
            {isListening ? 'Tap to finish' : 'Tap to speak'}
          </p>
          {error && <p className="text-[10px] text-red-500 mt-2 font-bold">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default App;
