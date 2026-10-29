import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Mic, MicOff, Video, VideoOff, RefreshCw, X, Radio, Volume2 } from 'lucide-react';
import { playTerminalSound } from '../utils/audioFX';

interface LiveModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutePrompt: (prompt: string) => Promise<string>;
  themeAccent: string;
}

export const LiveModeModal: React.FC<LiveModeModalProps> = ({
  isOpen,
  onClose,
  onExecutePrompt,
  themeAccent,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const [isCamOn, setIsCamOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [statusText, setStatusText] = useState('KHỞI TẠO PHẦN CỨNG...');
  const [userTranscript, setUserTranscript] = useState('Đang lắng nghe...');
  const [botReply, setBotReply] = useState('Hệ thống sẵn sàng tiếp nhận giọng nói.');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stop camera tracks cleanly
  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start camera with error boundary
  const initCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopCameraTracks();
    setStatusText('KẾT NỐI CAMERA...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatusText('CAMERA KẾT NỐI THÀNH CÔNG');
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setStatusText(`LỖI CAMERA: ${err.message || 'Không truy cập được'}`);
    }
  }, [stopCameraTracks]);

  // Text-To-Speech for live mode
  const speakLive = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    setStatusText('ĐANG PHÁT ÂM THANH...');

    const cleanText = text.replace(/[#*`~_\[\]]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.05;

    // Pick a Vietnamese or high-quality voice if available
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.includes('vi') || v.lang.includes('VN'));
    if (viVoice) utterance.voice = viVoice;

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatusText(isMicOn ? 'ĐANG LẮNG NGHE...' : 'MIC ĐANG TẮT');
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setStatusText(isMicOn ? 'ĐANG LẮNG NGHE...' : 'MIC ĐANG TẮT');
    };

    window.speechSynthesis.speak(utterance);
  }, [isMicOn]);

  // Speech recognition setup
  useEffect(() => {
    if (!isOpen) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusText('TRÌNH DUYỆT KHÔNG HỖ TRỢ SPEECH RECOGNITION');
      return;
    }

    const recog = new SpeechRecognition();
    recog.lang = 'vi-VN';
    recog.continuous = false;
    recog.interimResults = true;

    recog.onstart = () => {
      if (isMicOn && !isSpeaking) {
        setStatusText('ĐANG LẮNG NGHE GIỌNG NÓI...');
      }
    };

    recog.onresult = (event: any) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setUserTranscript(final || interim || '...');
    };

    recog.onerror = (e: any) => {
      if (e.error !== 'no-speech' && isMicOn) {
        console.warn('Speech error:', e.error);
      }
    };

    recog.onend = async () => {
      if (!isMicOn || isSpeaking) return;

      const captured = userTranscript.replace('Đang lắng nghe...', '').trim();
      if (captured && captured !== '...' && captured.length > 2) {
        setIsProcessing(true);
        setStatusText('AI ĐANG XỬ LÝ DỮ LIỆU...');
        try {
          const reply = await onExecutePrompt(captured);
          setBotReply(reply);
          speakLive(reply);
        } catch (err: any) {
          setBotReply(`[LỖI]: ${err.message || 'Không thể kết nối máy chủ'}`);
        } finally {
          setIsProcessing(false);
        }
      } else {
        // Restart listening after brief delay if still in live mode
        if (isOpen && isMicOn && !isSpeaking) {
          try {
            recog.start();
          } catch {}
        }
      }
    };

    recognitionRef.current = recog;

    if (isMicOn) {
      try {
        recog.start();
      } catch {}
    }

    return () => {
      try {
        recog.stop();
      } catch {}
    };
  }, [isOpen, isMicOn, isSpeaking, userTranscript, onExecutePrompt, speakLive]);

  // Open/Close cycle
  useEffect(() => {
    if (isOpen) {
      initCamera(facingMode);
      playTerminalSound('alert');
    } else {
      stopCameraTracks();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  }, [isOpen, facingMode, initCamera, stopCameraTracks]);

  // Toggle Camera
  const toggleCam = () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      const nextState = !videoTrack.enabled;
      videoTrack.enabled = nextState;
      setIsCamOn(nextState);
      playTerminalSound('click');
    }
  };

  // Toggle Mic
  const toggleMic = () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    playTerminalSound('click');
    if (!nextState && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setStatusText('MIC ĐÃ TẮT');
    } else {
      setStatusText('ĐANG LẮNG NGHE...');
      try {
        recognitionRef.current?.start();
      } catch {}
    }
  };

  // Flip Camera
  const flipCam = () => {
    playTerminalSound('click');
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 backdrop-blur-md p-3 sm:p-6 overflow-hidden">
      {/* Top HUD Header */}
      <div className="w-full max-w-5xl flex justify-between items-center border border-white/20 bg-black/80 px-4 py-2.5 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="font-bold tracking-wider text-xs sm:text-sm text-white">
            [9c2_LIVE_VISION_HUD]
          </span>
          <span className="hidden sm:inline-block text-[11px] text-gray-400 border-l border-white/20 pl-3">
            FPS: 60 | RES: 1280x720
          </span>
        </div>

        <button
          onClick={() => {
            playTerminalSound('click');
            onClose();
          }}
          className="flex items-center gap-1.5 px-3 py-1 text-xs sm:text-sm font-bold border border-red-500/60 text-red-400 hover:bg-red-500 hover:text-white rounded transition-colors"
        >
          <X className="w-4 h-4" />
          <span>[THOÁT]</span>
        </button>
      </div>

      {/* Main Video Viewport with HUD Brackets */}
      <div className="relative w-full max-w-5xl flex-1 my-2 sm:my-3 rounded-lg overflow-hidden border border-white/30 bg-[#0a0d14] flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover transition-all ${
            facingMode === 'user' ? 'scale-x-[-1]' : ''
          } ${!isCamOn ? 'opacity-0' : 'opacity-100'}`}
        />

        {/* Clean Vignette without stripes */}
        <div className="absolute inset-0 clean-vignette pointer-events-none"></div>

        {/* Camera Off Placeholder */}
        {!isCamOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-3">
            <VideoOff className="w-12 h-12 stroke-1" />
            <span className="text-sm font-mono tracking-widest">[VIDEO STREAM TẠM DỪNG]</span>
          </div>
        )}

        {/* Cyberpunk HUD Reticles & Targeting Brackets */}
        <div className="absolute inset-4 pointer-events-none flex flex-col justify-between">
          <div className="flex justify-between">
            <div className="w-8 h-8 border-t-2 border-l-2 border-emerald-400"></div>
            <div className="w-8 h-8 border-t-2 border-r-2 border-emerald-400"></div>
          </div>
          <div className="flex justify-center items-center">
            <div className="w-20 h-20 rounded-full border border-dashed border-emerald-400/40 animate-spin flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-emerald-400/60"></div>
            </div>
          </div>
          <div className="flex justify-between">
            <div className="w-8 h-8 border-b-2 border-l-2 border-emerald-400"></div>
            <div className="w-8 h-8 border-b-2 border-r-2 border-emerald-400"></div>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="absolute bottom-4 left-4 bg-black/85 border border-emerald-400/60 px-3 py-1.5 rounded text-xs font-mono text-emerald-400 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
          <span>&gt; {statusText}</span>
        </div>

        {/* Speaking Audio Wave Indicator */}
        {isSpeaking && (
          <div className="absolute top-4 right-4 bg-black/80 border border-cyan-400/80 px-3 py-1.5 rounded text-xs text-cyan-300 flex items-center gap-2 animate-pulse">
            <Volume2 className="w-4 h-4 text-cyan-400" />
            <span>AI ĐANG TRẢ LỜI</span>
          </div>
        )}
      </div>

      {/* Live Dialogues & Transcripts */}
      <div className="w-full max-w-5xl flex flex-col gap-2 mb-3">
        <div className="bg-black/80 border border-white/20 p-2.5 rounded-lg text-xs sm:text-sm text-gray-300 min-h-[44px] flex items-center gap-2">
          <span className="font-bold text-emerald-400 shrink-0">[Bạn]:</span>
          <span className="truncate italic">{userTranscript}</span>
        </div>
        <div className="bg-black/90 border border-emerald-500/40 p-2.5 rounded-lg text-xs sm:text-sm text-emerald-300 min-h-[56px] max-h-24 overflow-y-auto terminal-scroll">
          <span className="font-bold text-white shrink-0">[9c2 AI]: </span>
          <span>{botReply}</span>
        </div>
      </div>

      {/* Bottom Hardware Controls */}
      <div className="w-full max-w-5xl flex justify-center items-center gap-3 sm:gap-4 flex-wrap">
        <button
          onClick={toggleCam}
          className={`flex items-center gap-2 px-4 py-2 rounded border text-xs sm:text-sm font-bold transition-all ${
            isCamOn
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              : 'border-gray-600 bg-black text-gray-400 hover:text-white'
          }`}
        >
          {isCamOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          <span>{isCamOn ? '[CAM: BẬT]' : '[CAM: TẮT]'}</span>
        </button>

        <button
          onClick={toggleMic}
          className={`flex items-center gap-2 px-4 py-2 rounded border text-xs sm:text-sm font-bold transition-all ${
            isMicOn
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
              : 'border-red-500/60 bg-red-950/30 text-red-400 hover:bg-red-900/40'
          }`}
        >
          {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span>{isMicOn ? '[MIC: BẬT]' : '[MIC: TẮT]'}</span>
        </button>

        <button
          onClick={flipCam}
          className="flex items-center gap-2 px-4 py-2 rounded border border-white/40 bg-black text-white hover:bg-white hover:text-black text-xs sm:text-sm font-bold transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>[ĐỔI CAMERA]</span>
        </button>
      </div>
    </div>
  );
};
