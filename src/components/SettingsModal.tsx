import React from 'react';
import { X, Sliders, Volume2, Monitor, Key, Download, Check } from 'lucide-react';
import { TerminalTheme } from '../utils/terminalCommands';
import { playTerminalSound } from '../utils/audioFX';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: TerminalTheme;
  setTheme: (theme: TerminalTheme) => void;
  isCrtEnabled: boolean;
  setIsCrtEnabled: (val: boolean) => void;
  isSoundEnabled: boolean;
  setIsSoundEnabled: (val: boolean) => void;
  rapidApiKey: string;
  setRapidApiKey: (key: string) => void;
  onExportAllSessions: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  isCrtEnabled,
  setIsCrtEnabled,
  isSoundEnabled,
  setIsSoundEnabled,
  rapidApiKey,
  setRapidApiKey,
  onExportAllSessions,
}) => {
  if (!isOpen) return null;

  const themes: { id: TerminalTheme; name: string; color: string; border: string }[] = [
    { id: 'matrix', name: 'Matrix Emerald', color: '#10b981', border: 'border-emerald-500' },
    { id: 'cyberpunk', name: 'Cyberpunk Amber', color: '#f59e0b', border: 'border-amber-500' },
    { id: 'cyan', name: 'Neon Cyan', color: '#06b6d4', border: 'border-cyan-500' },
    { id: 'monochrome', name: 'Pure White', color: '#ffffff', border: 'border-white' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#090d14] border border-white/30 rounded-xl overflow-hidden shadow-2xl flex flex-col font-mono text-sm">
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-white/20 bg-black/60">
          <div className="flex items-center gap-2 text-white font-bold">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>[CẤU HÌNH HỆ THỐNG / SETTINGS]</span>
          </div>
          <button
            onClick={() => {
              playTerminalSound('click');
              onClose();
            }}
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[80vh] terminal-scroll">
          {/* Theme selection */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Chủ đề hiển thị (Terminal Palette)
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {themes.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    playTerminalSound('click');
                    setTheme(t.id);
                  }}
                  className={`flex items-center justify-between p-2.5 rounded border text-left transition-all ${
                    theme === t.id
                      ? `${t.border} bg-white/5 text-white font-bold ring-1 ring-white/30`
                      : 'border-white/10 text-gray-400 hover:border-white/30 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: t.color }}
                    ></span>
                    <span className="text-xs">{t.name}</span>
                  </div>
                  {theme === t.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* CRT & Sound toggles */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-300">Viền góc mờ dịu mắt (Ambient Vignette)</span>
              </div>
              <button
                onClick={() => {
                  playTerminalSound('click');
                  setIsCrtEnabled(!isCrtEnabled);
                }}
                className={`px-3 py-1.5 rounded text-xs font-bold border transition-colors min-h-[36px] min-w-[60px] flex items-center justify-center ${
                  isCrtEnabled
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
              >
                {isCrtEnabled ? '[BẬT]' : '[TẮT]'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-300">Âm thanh bàn phím cơ tổng hợp (SFX)</span>
              </div>
              <button
                onClick={() => {
                  setIsSoundEnabled(!isSoundEnabled);
                  if (!isSoundEnabled) playTerminalSound('success');
                }}
                className={`px-3 py-1 rounded text-xs font-bold border transition-colors ${
                  isSoundEnabled
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-gray-700 text-gray-500 hover:border-gray-500'
                }`}
              >
                {isSoundEnabled ? '[BẬT]' : '[TẮT]'}
              </button>
            </div>
          </div>

          {/* API Key Override */}
          <div className="pt-2 border-t border-white/10">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>Khóa RapidAPI Key (Tùy chọn)</span>
            </label>
            <input
              type="password"
              value={rapidApiKey}
              onChange={(e) => setRapidApiKey(e.target.value)}
              placeholder="Để trống nếu sử dụng khóa mặc định của hệ thống"
              className="w-full bg-black/60 border border-white/20 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Hệ thống tự động sử dụng khóa tích hợp hoặc dự phòng nếu khóa không được cung cấp.
            </p>
          </div>

          {/* Export session history */}
          <div className="pt-2 border-t border-white/10 flex justify-between items-center">
            <div>
              <span className="text-xs text-gray-300 block font-bold">Sao lưu dữ liệu hội thoại</span>
              <span className="text-[11px] text-gray-500">Tải về toàn bộ nhật ký phiên dạng Markdown</span>
            </div>
            <button
              onClick={() => {
                playTerminalSound('success');
                onExportAllSessions();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white hover:text-black text-white rounded text-xs font-bold transition-all border border-white/30"
            >
              <Download className="w-3.5 h-3.5" />
              <span>[XUẤT MD]</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-black/40 flex justify-end">
          <button
            onClick={() => {
              playTerminalSound('click');
              onClose();
            }}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded text-xs transition-colors"
          >
            ĐÓNG CẤU HÌNH
          </button>
        </div>
      </div>
    </div>
  );
};
