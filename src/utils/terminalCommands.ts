/**
 * Terminal command parsing, formatting, and session management logic.
 */

export interface TerminalCommandResult {
  isSystemCommand: boolean;
  action?: 'clear' | 'help' | 'model' | 'tts' | 'live' | 'edu' | 'theme' | 'stats' | 'export';
  payload?: string;
  output?: string;
}

export type TerminalTheme = 'matrix' | 'cyberpunk' | 'cyan' | 'monochrome';

export const SYSTEM_COMMANDS_HELP = `
[9c2 TERMINAL AI SYSTEM COMMANDS]
-----------------------------------------------------------
/help            - Hiển thị danh sách câu lệnh hệ thống
/clear or /cls   - Xóa màn hình terminal (giữ nguyên lịch sử phiên)
/model [flash|pro]- Chuyển đổi Model AI (v1.5 Flash hoặc v3 Pro)
/tts [on|off]    - Bật/tắt đọc phản hồi bằng giọng nói
/live            - Bật chế độ camera & voice trực tiếp (Live Mode)
/edu             - Kích hoạt chế độ giải bài tập qua camera (EDU Solver)
/theme [name]    - Đổi giao diện: matrix (xanh lá), cyberpunk (vàng/cam), cyan (lam), monochrome (trắng)
/stats           - Xem thông số hiệu năng và phiên làm việc
/export          - Xuất lịch sử trò chuyện dạng Markdown
-----------------------------------------------------------
Mẹo: Nhấn Enter để gửi lệnh, Shift + Enter để xuống dòng.
`.trim();

/**
 * Sanitizes AI responses according to system specs:
 * Replaces references to "Gemini" and "Google" with the user's custom brand.
 */
export function sanitizeModelReply(rawText: string, modelDisplayName: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/Gemini/gi, modelDisplayName)
    .replace(/Google LLC/gi, '9c2.io.vn Systems')
    .replace(/Google AI/gi, '9c2 AI Core')
    .replace(/\bGoogle\b/gi, '9c2.io.vn');
}

/**
 * Generates an informative title for a chat session from its first message.
 */
export function generateSessionTitle(firstPrompt?: string): string {
  if (!firstPrompt || !firstPrompt.trim()) return 'Phiên làm việc mới';
  const clean = firstPrompt.replace(/\[System Note:.*?\]/g, '').trim();
  if (!clean) return 'Tập tin đa phương tiện';
  return clean.length > 28 ? clean.substring(0, 28) + '...' : clean;
}

/**
 * Parses user input for slash commands or terminal directives.
 */
export function parseTerminalInput(input: string): TerminalCommandResult {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) {
    return { isSystemCommand: false };
  }

  const parts = trimmed.slice(1).split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const arg = parts.slice(1).join(' ').toLowerCase();

  switch (cmd) {
    case 'help':
    case '?':
      return {
        isSystemCommand: true,
        action: 'help',
        output: SYSTEM_COMMANDS_HELP,
      };

    case 'clear':
    case 'cls':
      return {
        isSystemCommand: true,
        action: 'clear',
        output: '[OK] Màn hình dòng lệnh đã được dọn sạch.',
      };

    case 'model':
    case 'mod':
    case 'mods': {
      if (arg === 'pro' || arg === 'v3') {
        return { isSystemCommand: true, action: 'model', payload: 'pro', output: '[MOD] Đã chuyển sang mô hình v3 Pro.' };
      }
      if (arg === 'flash' || arg === 'v1.5' || arg === '1.5') {
        return { isSystemCommand: true, action: 'model', payload: 'flash', output: '[MOD] Đã chuyển sang mô hình v1.5 Flash.' };
      }
      return { isSystemCommand: true, action: 'model', output: '[MOD] Cú pháp: /model flash hoặc /model pro' };
    }

    case 'tts': {
      if (arg === 'on' || arg === '1' || arg === 'true') {
        return { isSystemCommand: true, action: 'tts', payload: 'on', output: '[TTS] Đã bật giọng nói phản hồi.' };
      }
      if (arg === 'off' || arg === '0' || arg === 'false') {
        return { isSystemCommand: true, action: 'tts', payload: 'off', output: '[TTS] Đã tắt giọng nói phản hồi.' };
      }
      return { isSystemCommand: true, action: 'tts', payload: 'toggle', output: '[TTS] Đã đảo trạng thái giọng nói.' };
    }

    case 'live':
      return { isSystemCommand: true, action: 'live', output: '[LIVE] Đang khởi chạy giao diện Live Vision...' };

    case 'edu':
      return { isSystemCommand: true, action: 'edu', output: '[EDU] Đang mở máy ảnh phân tích & giải bài tập...' };

    case 'theme': {
      if (['matrix', 'cyberpunk', 'cyan', 'monochrome'].includes(arg)) {
        return { isSystemCommand: true, action: 'theme', payload: arg, output: `[THEME] Đã áp dụng giao diện màu: ${arg.toUpperCase()}` };
      }
      return { isSystemCommand: true, action: 'theme', output: '[THEME] Chọn một trong các giao diện: matrix, cyberpunk, cyan, monochrome' };
    }

    case 'stats':
      return { isSystemCommand: true, action: 'stats' };

    case 'export':
      return { isSystemCommand: true, action: 'export', output: '[EXPORT] Đang chuẩn bị tệp nhật ký Markdown...' };

    default:
      return {
        isSystemCommand: true,
        output: `[ERROR] Không nhận diện được lệnh /${cmd}. Nhập /help để xem danh sách lệnh hợp lệ.`,
      };
  }
}

/**
 * Builds the EDU mode prompt for image problem solving.
 */
export function buildEduPrompt(customInstructions?: string): string {
  const base = `Vui lòng phân tích hình ảnh này và giải chi tiết từng bước tất cả bài tập, câu hỏi hoặc phương trình có trong ảnh.

Cấu trúc trình bày:
1. **Đề bài nhận diện**: Tóm tắt lại câu hỏi/bài toán
2. **Phương pháp giải**: Nêu định lý, công thức hoặc kiến thức trọng tâm
3. **Lời giải chi tiết**: Từng bước tính toán, suy luận chặt chẽ và dễ hiểu
4. **Kết luận/Đáp số**: Đóng khung hoặc ghi rõ kết quả cuối cùng`;

  if (customInstructions && customInstructions.trim()) {
    return `${base}\n\n*Yêu cầu bổ sung từ người dùng*: ${customInstructions.trim()}`;
  }
  return base;
}
