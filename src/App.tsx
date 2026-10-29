import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  Paperclip,
  Mic,
  Video,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Search,
  Sliders,
  Maximize2,
  Send,
  BookOpen,
  X,
  ArrowDown,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  parseTerminalInput,
  sanitizeModelReply,
  generateSessionTitle,
  buildEduPrompt,
  TerminalTheme,
} from './utils/terminalCommands';
import { playTerminalSound } from './utils/audioFX';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { LiveModeModal } from './components/LiveModeModal';
import { SettingsModal } from './components/SettingsModal';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mediaData?: string;
  mediaType?: 'image' | 'video';
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const DEFAULT_RAPID_KEY = '82062eed6fmsh92015964630c98dp12fa5cjsn033c04642d1b';

export default function App() {
  // Session & Chat State
  const [sessions, setSessions] = useState<{ [id: string]: ChatSession }>(() => {
    try {
      const stored = localStorage.getItem('9c2_terminal_sessions');
      if (stored) return JSON.parse(stored);
    } catch {}
    const initId = Date.now().toString();
    return {
      [initId]: {
        id: initId,
        title: 'Phiên làm việc mới',
        messages: [
          {
            id: 'init-1',
            role: 'assistant',
            content: `Chào mừng bạn đến với **9c2 Terminal AI** [Hệ điều hành 9c2.io.vn].
Hệ thống sẵn sàng tiếp nhận lệnh. Nhập câu hỏi hoặc dùng các phím chức năng bên dưới:
- **[EDU]**: Chụp ảnh hoặc tải bài tập để giải chi tiết từng bước.
- **[LIVE]**: Bật camera & nhận diện giọng nói tương tác thời gian thực.
- **[MODS]**: Chuyển đổi giữa mô hình v1.5 Flash và v3 Pro.
- Gõ **/help** để xem tất cả câu lệnh dòng lệnh.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
        updatedAt: Date.now(),
      },
    };
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const keys = Object.keys(sessions);
    return keys[0] || Date.now().toString();
  });

  // UI & Configuration States
  const [modelMode, setModelMode] = useState<'flash' | 'pro'>('flash');
  const [theme, setTheme] = useState<TerminalTheme>('matrix');
  const [isCrtEnabled, setIsCrtEnabled] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const [isLiveOpen, setIsLiveOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [rapidApiKey, setRapidApiKey] = useState(() => {
    return localStorage.getItem('9c2_rapidapi_key') || DEFAULT_RAPID_KEY;
  });

  // Input & Processing States
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [previewZoomImage, setPreviewZoomImage] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSpeakingBot, setIsSpeakingBot] = useState(false);

  // References
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const eduInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const currentSession = sessions[currentSessionId] || {
    id: currentSessionId,
    title: 'Phiên làm việc',
    messages: [],
    updatedAt: Date.now(),
  };

  // Sync sessions to localStorage
  useEffect(() => {
    localStorage.setItem('9c2_terminal_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Sync API key to localStorage
  useEffect(() => {
    localStorage.setItem('9c2_rapidapi_key', rapidApiKey);
  }, [rapidApiKey]);

  // Auto-scroll handler
  const scrollToBottom = useCallback((smooth = true) => {
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [currentSession.messages, isProcessing, isAtBottom, scrollToBottom]);

  // Handle scroll detection
  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsAtBottom(atBottom);
  };

  // Sound triggering helper
  const triggerSound = useCallback((type: 'click' | 'execute' | 'error' | 'success' | 'alert') => {
    if (isSoundEnabled) {
      playTerminalSound(type);
    }
  }, [isSoundEnabled]);

  // TTS helper for messages
  const speakText = useCallback((text: string) => {
    if (!isTtsEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeakingBot(true);

    const clean = text.replace(/[#*`~_\[\]]/g, '').slice(0, 500);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.includes('vi') || v.lang.includes('VN'));
    if (viVoice) utterance.voice = viVoice;

    utterance.onend = () => setIsSpeakingBot(false);
    utterance.onerror = () => setIsSpeakingBot(false);

    window.speechSynthesis.speak(utterance);
  }, [isTtsEnabled]);

  // Web Speech Recognition for standard chat
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recog = new SpeechRec();
    recog.lang = 'vi-VN';
    recog.continuous = false;
    recog.interimResults = true;

    recog.onstart = () => {
      setIsRecording(true);
      triggerSound('alert');
    };

    recog.onresult = (e: any) => {
      let finalStr = '';
      for (let i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalStr += e.results[i][0].transcript;
        }
      }
      if (finalStr) {
        setInputText((prev) => (prev ? prev + ' ' + finalStr : finalStr));
      }
    };

    recog.onerror = () => {
      setIsRecording(false);
    };

    recog.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recog;
  }, [triggerSound]);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert('Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói (Web Speech API).');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        recognitionRef.current.stop();
      }
    }
  };

  // System Prompt based on selected model
  const getSystemPrompt = () => {
    const modelName = modelMode === 'flash' ? 'v1.5 Flash' : 'v3 Pro';
    return `You are ${modelName}, a high-performance terminal AI assistant for the 9c2.io.vn ecosystem. Your name is strictly ${modelName}. You are NOT Gemini and you were not made by Google. Never mention Gemini or Google. Always reply in the exact language of the user prompt (e.g. Vietnamese when asked in Vietnamese, English when in English). Provide clean, structured markdown code blocks and solutions.`;
  };

  // API Call Execution with Resilience & Timeout
  const callAIAPI = async (promptText: string, mediaData?: string): Promise<string> => {
    const activeKey = rapidApiKey.trim() || DEFAULT_RAPID_KEY;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const modelName = modelMode === 'flash' ? 'v1.5 Flash' : 'v3 Pro';

    try {
      let endpoint = '';
      let host = '';
      let body: any = {};

      if (modelMode === 'flash') {
        endpoint = 'https://gemini-1-5-flash.p.rapidapi.com/';
        host = 'gemini-1-5-flash.p.rapidapi.com';

        const historyMapped = currentSession.messages.map((m) => {
          if (m.mediaData) {
            return {
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: [
                { type: 'text', text: m.content },
                { type: 'image_url', image_url: { url: m.mediaData } },
              ],
            };
          }
          return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
        });

        const currentMsgContent: any[] = [{ type: 'text', text: promptText }];
        if (mediaData) {
          currentMsgContent.push({ type: 'image_url', image_url: { url: mediaData } });
        }

        body = {
          model: 'gemini-1.5-flash',
          messages: [
            { role: 'system', content: getSystemPrompt() },
            ...historyMapped.slice(-8),
            { role: 'user', content: currentMsgContent },
          ],
        };
      } else {
        endpoint = 'https://gemini-pro-ai.p.rapidapi.com/';
        host = 'gemini-pro-ai.p.rapidapi.com';

        const parts: any[] = [{ text: `[System: ${getSystemPrompt()}]\n\nUser: ${promptText}` }];
        if (mediaData) {
          parts.push({ text: `\n[Image Data attached in interface: ${mediaData.substring(0, 50)}...]` });
        }

        body = {
          model: 'gemini-2.5-pro',
          contents: [
            ...currentSession.messages.slice(-6).map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            { role: 'user', parts },
          ],
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': host,
          'x-rapidapi-key': activeKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`RapidAPI Status ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      let botResponse = '';

      if (data.result && typeof data.result === 'string') botResponse = data.result;
      else if (data.choices?.[0]?.message?.content) botResponse = data.choices[0].message.content;
      else if (data.candidates?.[0]?.content?.parts) {
        botResponse = data.candidates[0].content.parts.map((p: any) => p.text).join('\n');
      } else if (data.message) botResponse = data.message;
      else if (data.answer) botResponse = data.answer;
      else if (data.response) botResponse = data.response;
      else {
        botResponse = JSON.stringify(data, null, 2);
      }

      return sanitizeModelReply(botResponse, modelName);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('API Execution encountered an issue:', err);

      return `[DIAGNOSTIC ALERT]: Kết nối API trực tiếp gặp gián đoạn (${err.message || 'Hết quota/Mạng'}).
Hệ thống **9c2 AI Core (${modelName})** đã kích hoạt chế độ dự phòng an toàn:
> Câu hỏi của bạn: "${promptText.slice(0, 80)}..."
Vui lòng kiểm tra lại cấu hình API Key trong mục **[CẤU HÌNH]** hoặc thử lại sau giây lát.`;
    }
  };

  // Submit Handler for user input
  const handleSendMessage = async (customPrompt?: string, customMedia?: { url: string; type: 'image' | 'video' }) => {
    const rawText = customPrompt !== undefined ? customPrompt : inputText;
    const media = customMedia || pendingMedia;

    if (!rawText.trim() && !media) return;

    triggerSound('execute');
    setInputText('');
    setPendingMedia(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Check for slash commands first
    const parsedCmd = parseTerminalInput(rawText);
    if (parsedCmd.isSystemCommand) {
      handleSystemCommand(parsedCmd);
      return;
    }

    const userMsgId = 'msg-' + Date.now();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: rawText || (media?.type === 'video' ? '[Tập tin Video đính kèm]' : '[Tập tin Hình ảnh đính kèm]'),
      mediaData: media?.url,
      mediaType: media?.type,
      timestamp: timeStr,
    };

    let sessionTitle = currentSession.title;
    if (currentSession.messages.filter((m) => m.role === 'user').length === 0) {
      sessionTitle = generateSessionTitle(rawText);
    }

    setSessions((prev) => ({
      ...prev,
      [currentSessionId]: {
        ...currentSession,
        title: sessionTitle,
        messages: [...currentSession.messages, newUserMessage],
        updatedAt: Date.now(),
      },
    }));

    setIsProcessing(true);

    try {
      const reply = await callAIAPI(rawText, media?.url);
      triggerSound('success');

      const botMsg: Message = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSessions((prev) => {
        const cur = prev[currentSessionId];
        return {
          ...prev,
          [currentSessionId]: {
            ...cur,
            messages: [...cur.messages, botMsg],
            updatedAt: Date.now(),
          },
        };
      });

      speakText(reply);
    } catch (err: any) {
      triggerSound('error');
      const errorMsg: Message = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `[FATAL EXCEPTION]: ${err.message || 'Lỗi không xác định khi thực thi câu lệnh.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setSessions((prev) => {
        const cur = prev[currentSessionId];
        return {
          ...prev,
          [currentSessionId]: {
            ...cur,
            messages: [...cur.messages, errorMsg],
            updatedAt: Date.now(),
          },
        };
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  // Slash command execution
  const handleSystemCommand = (cmd: ReturnType<typeof parseTerminalInput>) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (cmd.action === 'clear') {
      triggerSound('click');
      setSessions((prev) => ({
        ...prev,
        [currentSessionId]: {
          ...currentSession,
          messages: [
            {
              id: 'clr-' + Date.now(),
              role: 'assistant',
              content: '[OK] Màn hình đã dọn sạch. Bạn có thể tiếp tục nhập lệnh.',
              timestamp: timeStr,
            },
          ],
        },
      }));
      return;
    }

    if (cmd.action === 'model' && cmd.payload) {
      setModelMode(cmd.payload as 'flash' | 'pro');
      triggerSound('click');
    }

    if (cmd.action === 'theme' && cmd.payload) {
      setTheme(cmd.payload as TerminalTheme);
      triggerSound('click');
    }

    if (cmd.action === 'tts') {
      if (cmd.payload === 'on') setIsTtsEnabled(true);
      else if (cmd.payload === 'off') setIsTtsEnabled(false);
      else setIsTtsEnabled((prev) => !prev);
      triggerSound('click');
    }

    if (cmd.action === 'live') {
      setIsLiveOpen(true);
      return;
    }

    if (cmd.action === 'edu') {
      eduInputRef.current?.click();
      return;
    }

    if (cmd.action === 'export') {
      exportCurrentSession();
      return;
    }

    if (cmd.action === 'stats') {
      const statsMsg: Message = {
        id: 'stats-' + Date.now(),
        role: 'assistant',
        content: `[9c2 SYSTEM DIAGNOSTICS]
- Hostname: root@9c2.io.vn
- AI Model: ${modelMode === 'flash' ? 'v1.5 Flash' : 'v3 Pro'}
- Active Sessions: ${Object.keys(sessions).length}
- Current Messages: ${currentSession.messages.length}
- Latency: ~18ms
- Memory Allocation: Normal (Heap: 42MB)
- Web Audio SFX: ${isSoundEnabled ? 'BẬT' : 'TẮT'}
- Text-to-Speech: ${isTtsEnabled ? 'BẬT' : 'TẮT'}`,
        timestamp: timeStr,
      };

      setSessions((prev) => ({
        ...prev,
        [currentSessionId]: {
          ...currentSession,
          messages: [...currentSession.messages, statsMsg],
        },
      }));
      return;
    }

    if (cmd.output) {
      const systemReply: Message = {
        id: 'sys-' + Date.now(),
        role: 'assistant',
        content: cmd.output,
        timestamp: timeStr,
      };

      setSessions((prev) => ({
        ...prev,
        [currentSessionId]: {
          ...currentSession,
          messages: [...currentSession.messages, systemReply],
        },
      }));
    }
  };

  // EDU Mode File Picker & Auto Solver
  const handleEduUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerSound('alert');
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const eduPrompt = buildEduPrompt();
      handleSendMessage(eduPrompt, { url: base64, type: 'image' });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Regular File Picker
  const handleRegularFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPendingMedia({ url: base64, type: isVideo ? 'video' : 'image' });
      triggerSound('click');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // New Chat session
  const handleNewChat = () => {
    triggerSound('click');
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'Phiên làm việc mới',
      messages: [
        {
          id: 'init-' + Date.now(),
          role: 'assistant',
          content: `Phiên làm việc mới đã khởi tạo trên **root@9c2.io.vn**. Hãy nhập câu hỏi hoặc câu lệnh.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
      updatedAt: Date.now(),
    };

    setSessions((prev) => ({
      ...prev,
      [newId]: newSession,
    }));
    setCurrentSessionId(newId);
    setIsSidebarOpen(false);
  };

  // Delete session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    triggerSound('click');
    const keys = Object.keys(sessions);
    if (keys.length <= 1) {
      handleNewChat();
      return;
    }

    const newSessions = { ...sessions };
    delete newSessions[id];
    setSessions(newSessions);

    if (currentSessionId === id) {
      const remainingKeys = Object.keys(newSessions);
      setCurrentSessionId(remainingKeys[0]);
    }
  };

  // Export current session as Markdown
  const exportCurrentSession = () => {
    let md = `# Nhật ký phiên làm việc: ${currentSession.title}\n`;
    md += `Thời gian xuất: ${new Date().toLocaleString()}\nHệ điều hành: 9c2.io.vn Terminal AI\n\n---\n\n`;

    currentSession.messages.forEach((m) => {
      const author = m.role === 'user' ? 'GUEST' : 'ROOT@9c2';
      md += `### [${m.timestamp}] ${author}:\n${m.content}\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `9c2_log_${currentSession.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export all sessions as JSON
  const exportAllSessions = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sessions, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `9c2_all_sessions_${Date.now()}.json`);
    dlAnchor.click();
  };

  // Dynamic Theme Colors
  const themeClasses = {
    matrix: {
      accentText: 'text-emerald-400',
      accentBg: 'bg-emerald-500',
      accentBorder: 'border-emerald-500',
      glow: 'glow-emerald',
      promptColor: 'text-emerald-400',
    },
    cyberpunk: {
      accentText: 'text-amber-400',
      accentBg: 'bg-amber-500',
      accentBorder: 'border-amber-500',
      glow: 'glow-amber',
      promptColor: 'text-amber-400',
    },
    cyan: {
      accentText: 'text-cyan-400',
      accentBg: 'bg-cyan-500',
      accentBorder: 'border-cyan-500',
      glow: 'glow-cyan',
      promptColor: 'text-cyan-400',
    },
    monochrome: {
      accentText: 'text-white',
      accentBg: 'bg-white',
      accentBorder: 'border-white',
      glow: 'shadow-none',
      promptColor: 'text-white',
    },
  }[theme];

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-[#07090e] text-slate-100 font-mono select-none antialiased">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleRegularFileUpload}
      />
      <input
        ref={eduInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleEduUpload}
      />

      {/* Sidebar Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar / Logs Panel (Drawer on Mobile, Static Column on PC) */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 w-72 lg:w-80 bg-[#090c13] border-r border-white/10 z-50 transform ${
          isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        } transition-transform duration-300 ease-in-out flex flex-col shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <Terminal className={`w-4 h-4 ${themeClasses.accentText}`} />
            <span className="font-bold text-xs tracking-wider uppercase text-white">[NHẬT KÝ PHIÊN]</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-gray-400 hover:text-white rounded active:bg-white/10 transition-colors"
            aria-label="Đóng nhật ký"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons: New Chat & Clear */}
        <div className="p-3 border-b border-white/10 flex gap-2">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 border border-white/20 active:bg-white/20 text-xs font-bold text-white bg-white/5 rounded-md min-h-[42px] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>[PHIÊN MỚI]</span>
          </button>
          <button
            onClick={() => {
              handleSystemCommand({ isSystemCommand: true, action: 'clear' });
              setIsSidebarOpen(false);
            }}
            className="flex items-center justify-center py-2.5 px-3 border border-white/20 active:border-red-400 text-xs font-bold text-gray-300 hover:text-red-400 bg-white/5 rounded-md min-h-[42px] transition-colors"
            title="Dọn sạch màn hình dòng lệnh"
          >
            <span>[CLR]</span>
          </button>
        </div>

        {/* Search Filter for Sessions */}
        <div className="p-3 border-b border-white/10">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Tìm kiếm nhật ký..."
              className="w-full bg-black/50 border border-white/15 rounded-md pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/40"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2 terminal-scroll">
          {Object.values(sessions)
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .filter((s) => s.title.toLowerCase().includes(historySearch.toLowerCase()))
            .map((s) => {
              const isActive = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setCurrentSessionId(s.id);
                    setIsSidebarOpen(false);
                    triggerSound('click');
                  }}
                  className={`group flex items-center justify-between p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isActive
                      ? `${themeClasses.accentBorder} bg-white/5 ${themeClasses.accentText} font-bold ring-1 ring-white/10`
                      : 'border-transparent hover:border-white/15 active:bg-white/10 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-xs sm:text-sm truncate">{s.title}</p>
                    <span className="text-[10px] text-gray-500 block mt-0.5">
                      {new Date(s.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                      {s.messages.length} tin nhắn
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(s.id, e)}
                    className="p-1.5 hover:text-red-400 rounded min-h-[36px] min-w-[36px] flex items-center justify-center transition-opacity"
                    title="Xóa phiên"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
        </div>

        {/* Sidebar Footer System Telemetry */}
        <div className="p-3 border-t border-white/10 bg-black/60 text-[11px] text-gray-400 flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span>CORE STATUS:</span>
            <span className={`${themeClasses.accentText} flex items-center gap-1.5 font-bold`}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px] text-gray-500">
            <span>KERNEL: 9c2-v2.5</span>
            <span>PING: ~18ms</span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Header Bar with Mobile Notch Inset */}
        <header className="border-b border-white/10 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 px-3 sm:px-5 flex items-center justify-between z-10 shrink-0 bg-[#090c13]/95 backdrop-blur-md">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden border border-white/20 px-2.5 py-1.5 text-xs text-white active:bg-white active:text-black rounded min-h-[38px] flex items-center justify-center transition-colors font-bold"
              aria-label="Mở nhật ký"
            >
              [LOGS]
            </button>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold tracking-wider text-xs sm:text-sm text-white">
                  root@9c2.io.vn:~#
                </h1>
                <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded border border-white/20 text-gray-400">
                  9c2 AI Core
                </span>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${themeClasses.accentBg} animate-pulse`}></span>
                <span className="truncate max-w-[150px] sm:max-w-none">ONLINE · #{currentSessionId.slice(-4)}</span>
              </p>
            </div>
          </div>

          {/* Interactive Header Toggles */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs font-bold">
            {/* Model Switcher */}
            <button
              onClick={() => {
                const next = modelMode === 'flash' ? 'pro' : 'flash';
                setModelMode(next);
                triggerSound('click');
              }}
              className={`flex items-center gap-1 border px-2 sm:px-2.5 py-1.5 rounded min-h-[36px] transition-all ${
                modelMode === 'pro'
                  ? 'border-amber-400/80 bg-amber-500/10 text-amber-300'
                  : 'border-white/30 text-white active:bg-white/10'
              }`}
              title="Chuyển đổi Model AI"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden md:inline">[MODS:</span>
              <span>{modelMode === 'flash' ? 'Flash' : 'Pro'}</span>
              <span className="hidden md:inline">]</span>
            </button>

            {/* Live Camera Button */}
            <button
              onClick={() => {
                triggerSound('alert');
                setIsLiveOpen(true);
              }}
              className="flex items-center gap-1 border border-emerald-400/80 bg-emerald-500/10 text-emerald-300 active:bg-emerald-500/30 px-2 sm:px-2.5 py-1.5 rounded min-h-[36px] transition-colors"
              title="Mở giao diện Live Vision & Voice"
            >
              <Video className="w-3.5 h-3.5 shrink-0" />
              <span>[LIVE]</span>
            </button>

            {/* TTS Toggle */}
            <button
              onClick={() => {
                setIsTtsEnabled(!isTtsEnabled);
                triggerSound('click');
                if (isTtsEnabled && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                  setIsSpeakingBot(false);
                }
              }}
              className={`flex items-center gap-1 border px-2 py-1.5 rounded min-h-[36px] transition-all ${
                isTtsEnabled
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                  : 'border-white/20 text-gray-400 active:text-white'
              }`}
              title="Bật/Tắt đọc bằng giọng nói"
            >
              {isTtsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isTtsEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Settings Modal Toggle */}
            <button
              onClick={() => {
                triggerSound('click');
                setIsSettingsOpen(true);
              }}
              className="p-2 border border-white/20 active:border-white text-gray-300 active:text-white rounded min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
              title="Cấu hình hệ thống"
              aria-label="Cấu hình hệ thống"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Quick Command Navigation Pill Chips with smooth touch scroll */}
        <div className="border-b border-white/10 px-3 sm:px-4 py-1.5 bg-black/40 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <span className="text-gray-500 text-[10px] shrink-0 font-mono select-none">LỆNH:</span>
          {[
            { label: '/help', desc: 'Trợ giúp' },
            { label: '/clear', desc: 'Dọn màn hình' },
            { label: '/model pro', desc: 'Đổi v3 Pro' },
            { label: '/stats', desc: 'Thông số' },
            { label: '/theme cyberpunk', desc: 'Đổi theme' },
            { label: '/export', desc: 'Xuất tệp' },
          ].map((c) => (
            <button
              key={c.label}
              onClick={() => {
                setInputText(c.label);
                handleSendMessage(c.label);
              }}
              className="shrink-0 px-2.5 py-1 rounded border border-white/15 active:border-emerald-400 text-gray-300 hover:text-emerald-300 bg-white/[0.03] text-[11px] min-h-[32px] flex items-center justify-center transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Chat / Terminal Stream Area (Clear & Crisp text, NO horizontal stripes) */}
        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 terminal-scroll flex flex-col gap-5 sm:gap-6"
        >
          <div className="w-full max-w-5xl mx-auto flex flex-col gap-5 sm:gap-6">
            <AnimatePresence initial={false}>
              {currentSession.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`w-full group ${isUser ? 'text-slate-100' : themeClasses.accentText}`}
                  >
                    {/* Prompt Header Line */}
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <div className="flex items-center gap-1.5 font-bold font-mono">
                        <span className={isUser ? 'text-slate-300' : themeClasses.promptColor}>
                          {isUser ? 'guest@9c2.io.vn:~$ ' : 'root@9c2.io.vn:~# '}
                        </span>
                        {!isUser && (
                          <span className="text-[10px] text-gray-500 font-normal">
                            ({modelMode === 'flash' ? 'v1.5 Flash' : 'v3 Pro'})
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* Media Attachment if exists */}
                    {msg.mediaData && (
                      <div className="pl-3 sm:pl-4 mb-2.5">
                        <div className="relative inline-block border border-white/20 rounded-lg overflow-hidden max-w-full sm:max-w-md max-h-72 bg-black/60 group/media">
                          {msg.mediaType === 'video' ? (
                            <video src={msg.mediaData} controls className="max-h-72 w-full object-contain" />
                          ) : (
                            <>
                              <img
                                src={msg.mediaData}
                                alt="Uploaded Media"
                                className="max-h-72 w-full object-contain cursor-zoom-in"
                                onClick={() => setPreviewZoomImage(msg.mediaData!)}
                              />
                              <button
                                onClick={() => setPreviewZoomImage(msg.mediaData!)}
                                className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-white text-white hover:text-black rounded opacity-80 sm:opacity-0 group-hover/media:opacity-100 transition-opacity"
                                title="Xem toàn màn hình"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Message Body Content */}
                    <div className="pl-3 sm:pl-4">
                      {isUser ? (
                        <p className="whitespace-pre-wrap leading-relaxed break-words font-mono text-sm sm:text-base text-slate-100">
                          {msg.content}
                        </p>
                      ) : (
                        <MarkdownRenderer content={msg.content} themeAccent={theme} />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`w-full ${themeClasses.accentText}`}
              >
                <div className="font-bold mb-1 text-xs font-mono">root@9c2.io.vn:~#</div>
                <div className="pl-3 sm:pl-4 flex items-center gap-2">
                  <span className="terminal-cursor"></span>
                  <span className="text-xs text-gray-400 font-mono animate-pulse">
                    Đang tính toán từ 9c2 AI Core...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Scroll to bottom floating button */}
        {!isAtBottom && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 right-4 sm:right-8 z-30 p-2.5 rounded-full bg-black/80 border border-white/30 text-white active:bg-white active:text-black shadow-lg transition-all min-h-[42px] min-w-[42px] flex items-center justify-center"
            title="Cuộn xuống cuối"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Bottom Input Area optimized for Mobile Keyboard & Insets */}
        <footer className="border-t border-white/10 p-2.5 sm:p-4 bg-[#080b12] shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="max-w-5xl mx-auto flex flex-col gap-2"
          >
            {/* Pending Media Preview Badge */}
            {pendingMedia && (
              <div className="flex items-center gap-2.5 p-2 bg-black/60 border border-white/20 rounded-lg max-w-fit">
                {pendingMedia.type === 'video' ? (
                  <Video className="w-5 h-5 text-emerald-400" />
                ) : (
                  <img
                    src={pendingMedia.url}
                    alt="Preview"
                    className="w-10 h-10 object-cover rounded border border-white/20"
                  />
                )}
                <span className="text-xs text-gray-300">
                  {pendingMedia.type === 'video' ? 'Đã chọn video' : 'Đã chọn ảnh'}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingMedia(null)}
                  className="p-1 hover:text-red-400 text-gray-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Main Command Input Box (16px base font on mobile prevents unwanted Safari auto-zoom) */}
            <div className="flex-1 border border-white/20 focus-within:border-white focus-within:ring-1 focus-within:ring-white/40 flex items-center bg-black/80 rounded-lg min-h-[48px] px-3 transition-all">
              <span className={`font-bold select-none text-base mr-2 ${themeClasses.promptColor}`}>
                ${' '}
              </span>
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim() || pendingMedia) {
                      handleSendMessage();
                    }
                  }
                }}
                disabled={isProcessing}
                placeholder="Nhập câu lệnh, câu hỏi hoặc gõ /help..."
                className="w-full bg-transparent border-none focus:ring-0 resize-none py-3 text-slate-100 placeholder-gray-500 outline-none max-h-40 font-mono text-base sm:text-sm leading-relaxed"
              />
            </div>

            {/* Bottom Actions Row - Responsive & Thumb-Friendly */}
            <div className="flex justify-between items-center w-full gap-2 pt-0.5">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* Regular File Upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 border border-white/20 active:border-white px-2.5 sm:px-3 py-2 text-xs font-bold text-gray-300 active:text-white rounded-md bg-white/[0.03] min-h-[40px] transition-colors"
                  title="Tải lên tệp ảnh hoặc video"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">[TẬP TIN]</span>
                  <span className="inline sm:hidden">[FILE]</span>
                </button>

                {/* Speech Recognition Mic */}
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`flex items-center gap-1.5 border px-2.5 sm:px-3 py-2 text-xs font-bold rounded-md min-h-[40px] transition-colors ${
                    isRecording
                      ? 'border-red-500 bg-red-500 text-white animate-pulse'
                      : 'border-white/20 active:border-white text-gray-300 active:text-white bg-white/[0.03]'
                  }`}
                  title="Nhận diện giọng nói tiếng Việt"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{isRecording ? '[REC...]' : '[MIC]'}</span>
                </button>

                {/* EDU Mode Solver Camera */}
                <button
                  type="button"
                  onClick={() => eduInputRef.current?.click()}
                  className="flex items-center gap-1.5 border border-cyan-400/80 bg-cyan-500/10 text-cyan-300 active:bg-cyan-500/20 px-2.5 sm:px-3.5 py-2 text-xs font-bold rounded-md min-h-[40px] transition-colors"
                  title="Chụp ảnh giải bài tập tự động từng bước"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">[GIẢI BÀI TẬP EDU]</span>
                  <span className="inline sm:hidden">[EDU]</span>
                </button>
              </div>

              {/* Execute Button */}
              <button
                type="submit"
                disabled={isProcessing || (!inputText.trim() && !pendingMedia)}
                className="flex items-center justify-center gap-2 border border-white bg-white text-black font-bold px-4 sm:px-5 py-2 text-xs sm:text-sm active:bg-gray-200 transition-colors rounded-md disabled:opacity-40 disabled:cursor-not-allowed shrink-0 min-h-[40px]"
              >
                <span>EXEC</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </footer>
      </main>

      {/* Live Mode HUD Overlay Modal */}
      <LiveModeModal
        isOpen={isLiveOpen}
        onClose={() => setIsLiveOpen(false)}
        onExecutePrompt={(prompt) => callAIAPI(prompt)}
        themeAccent={theme}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        isCrtEnabled={isCrtEnabled}
        setIsCrtEnabled={setIsCrtEnabled}
        isSoundEnabled={isSoundEnabled}
        setIsSoundEnabled={setIsSoundEnabled}
        rapidApiKey={rapidApiKey}
        setRapidApiKey={setRapidApiKey}
        onExportAllSessions={exportAllSessions}
      />

      {/* Fullscreen Image Preview Zoom Modal */}
      {previewZoomImage && (
        <div
          onClick={() => setPreviewZoomImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 cursor-zoom-out"
        >
          <img
            src={previewZoomImage}
            alt="Zoomed"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded border border-white/20"
          />
          <button
            onClick={() => setPreviewZoomImage(null)}
            className="absolute top-4 right-4 p-2.5 bg-black/70 active:bg-white text-white active:text-black rounded-full border border-white/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
