import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, User, Bot, Loader2, X, Menu, Plus, MessageSquare, Trash2 } from 'lucide-react';

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
  const [isMobile, setIsMobile] = useState(false);

  // Refs for logic
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const synthRef = useRef<SpeechSynthesis>(window.speechSynthesis);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  
  // Streaming & Queue Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sentenceBufferRef = useRef('');

  useEffect(() => {
    const savedHistory = localStorage.getItem('karthik_chat_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobileCheck);

    audioRef.current = new Audio();
    audioRef.current.onended = () => playNextInQueue();

    // PRE-WARM APIs
    fetch('/api/chat', { method: 'OPTIONS' }).catch(() => {});
    fetch('/api/speak', { method: 'OPTIONS' }).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('karthik_chat_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat, isLoading]);

  const stopAllSpeech = () => {
    // Stop Native TTS
    synthRef.current.cancel();
    // Stop Streaming Audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    // Clear Queues
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    sentenceBufferRef.current = '';
    // Abort ongoing text stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const startRecording = async () => {
    try {
      stopAllSpeech();
      // Unlock mobile audio
      if (audioRef.current) {
        audioRef.current.play().then(() => audioRef.current?.pause()).catch(() => {});
      }
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
      if (data.text?.trim()) {
        await handleSendMessage(data.text);
      } else {
        setError('No speech detected.');
      }
    } catch (err: any) {
      setError('Transcription failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    stopAllSpeech();
    const newMessages: Message[] = [...currentChat, { role: 'user', content: text }];
    setCurrentChat(newMessages);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) throw new Error('Chat failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      let fullText = '';
      setIsLoading(false); // Hide thinking as tokens arrive

      // Start Assistant Message placeholder
      setCurrentChat(prev => [...prev, { role: 'assistant', content: '' }]);

      const decoder = new TextDecoder();
      let streamBuffer = ''; // BUFFER FOR PARTIAL CHUNKS

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        streamBuffer += decoder.decode(value, { stream: true });
        
        const lines = streamBuffer.split('\n');
        // Keep the last partial line in the buffer
        streamBuffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
          
          const dataStr = trimmedLine.replace('data: ', '');
          if (dataStr === '[DONE]') break;
          
          try {
            const data = JSON.parse(dataStr);
            const token = data.choices[0]?.delta?.content || '';
            if (token) {
              fullText += token;
              sentenceBufferRef.current += token;
              
              // Update UI (Direct update for speed)
              setCurrentChat(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = fullText;
                return updated;
              });

              // ROBUST SENTENCE DETECTION (Mobile Only)
              if (isMobile) {
                // Trigger audio if we find punctuation AND buffer is long enough
                if (/[.!?\n]/.test(token) && sentenceBufferRef.current.trim().length > 10) {
                  fetchAudioForSentence(sentenceBufferRef.current.trim());
                  sentenceBufferRef.current = '';
                }
              }
            }
          } catch (e) {
            // console.error("Parse error", e, dataStr);
          }
        }
      }

      // Final cleanup for any leftover text
      if (isMobile && sentenceBufferRef.current.trim().length > 0) {
        fetchAudioForSentence(sentenceBufferRef.current.trim());
      } else if (!isMobile) {
        speakNative(fullText);
      }

      // Sync to history
      const finalMessages: Message[] = [...newMessages, { role: 'assistant', content: fullText }];
      if (activeSessionId) {
        setHistory(h => h.map(s => s.id === activeSessionId ? { ...s, messages: finalMessages } : s));
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

    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('AI Error: ' + err.message);
      }
      setIsLoading(false);
    }
  };

  // --- Voice Pipeline (Mobile: OpenAI Sentence-by-Sentence) ---
  const fetchAudioForSentence = async (text: string) => {
    try {
      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioQueueRef.current.push(url);
      if (!isPlayingRef.current) {
        playNextInQueue();
      }
    } catch (e) {}
  };

  const playNextInQueue = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    const nextUrl = audioQueueRef.current.shift();
    if (nextUrl && audioRef.current) {
      isPlayingRef.current = true;
      audioRef.current.src = nextUrl;
      audioRef.current.play().catch(() => {
        isPlayingRef.current = false;
      });
    }
  };

  // --- Voice Pipeline (PC: Native Zero-Delay) ---
  const speakNative = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    const maleVoice = voices.find(v => v.name.includes('David') || v.name.includes('James')) || voices[0];
    if (maleVoice) utterance.voice = maleVoice;
    utterance.rate = 0.95;
    synthRef.current.speak(utterance);
  };

  const startNewChat = () => {
    stopAllSpeech();
    setCurrentChat([]);
    setActiveSessionId(null);
    setIsSidebarOpen(false);
    setError(null);
  };

  const loadSession = (session: ChatSession) => {
    stopAllSpeech();
    setCurrentChat(session.messages);
    setActiveSessionId(session.id);
    setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    stopAllSpeech();
    setHistory(history.filter(s => s.id !== id));
    if (activeSessionId === id) {
      setCurrentChat([]);
      setActiveSessionId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#020617] text-slate-200 font-sans flex overflow-hidden w-full h-full">
      
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-full sm:w-80 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">History</h2>
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
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center">
          <div className="w-full max-w-4xl space-y-6">
            {currentChat.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse"><Bot size={32} className="text-white" /></div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Interactive AI Voice Assistant</h2>
                  <p className="text-slate-500 text-sm mt-2 text-center max-w-md">Hello, this is Karthik Murugesan, an AI-powered voice chatbot for real-time conversations.</p>
                </div>
              </div>
            )}

            {currentChat.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`flex max-w-[90%] sm:max-w-[80%] items-start space-x-3 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600 shadow-lg' : 'bg-slate-800 border border-slate-700'}`}>
                    {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-indigo-400" />}
                  </div>
                  <div className={`p-4 rounded-2xl ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-xl' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700 shadow-2xl'}`}>
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap font-medium">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center space-x-3">
                  <Loader2 className="animate-spin text-indigo-400" size={16} />
                  <span className="text-xs text-slate-500 font-medium tracking-widest uppercase italic">Thinking</span>
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
               <p className="text-sm text-slate-400 italic leading-relaxed">Speak naturally. Tap the button when finished.</p>
            </div>
          )}

          <button onClick={isListening ? stopRecording : startRecording} disabled={isLoading} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-90 ${isListening ? 'bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]' : 'bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.3)]'}`}>
            {isListening ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-white" />}
          </button>
          
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4">
            {isListening ? 'Tap to finish' : 'Tap to start'}
          </p>
          {error && <p className="text-[10px] text-red-500 mt-2 font-bold">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default App;
