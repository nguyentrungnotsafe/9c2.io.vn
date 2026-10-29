import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTerminalInput,
  sanitizeModelReply,
  generateSessionTitle,
  buildEduPrompt,
} from './terminalCommands';

test('parseTerminalInput handles regular text input as non-command', () => {
  const res = parseTerminalInput('Xin chào bot 9c2');
  assert.equal(res.isSystemCommand, false);
});

test('parseTerminalInput recognizes /help and /clear', () => {
  const helpRes = parseTerminalInput('/help');
  assert.equal(helpRes.isSystemCommand, true);
  assert.equal(helpRes.action, 'help');
  assert.ok(helpRes.output?.includes('[9c2 TERMINAL AI SYSTEM COMMANDS]'));

  const clearRes = parseTerminalInput('/clear');
  assert.equal(clearRes.isSystemCommand, true);
  assert.equal(clearRes.action, 'clear');
});

test('parseTerminalInput parses /model arguments correctly', () => {
  const proRes = parseTerminalInput('/model pro');
  assert.equal(proRes.isSystemCommand, true);
  assert.equal(proRes.action, 'model');
  assert.equal(proRes.payload, 'pro');

  const flashRes = parseTerminalInput('/model flash');
  assert.equal(flashRes.isSystemCommand, true);
  assert.equal(flashRes.action, 'model');
  assert.equal(flashRes.payload, 'flash');
});

test('parseTerminalInput parses /theme arguments correctly', () => {
  const themeRes = parseTerminalInput('/theme cyberpunk');
  assert.equal(themeRes.isSystemCommand, true);
  assert.equal(themeRes.action, 'theme');
  assert.equal(themeRes.payload, 'cyberpunk');
});

test('sanitizeModelReply removes Google/Gemini branding according to system prompt', () => {
  const raw = 'I am Gemini, a large language model trained by Google. Google created me.';
  const sanitized = sanitizeModelReply(raw, 'v1.5 Flash');
  assert.equal(sanitized.includes('Gemini'), false);
  assert.equal(sanitized.includes('Google'), false);
  assert.ok(sanitized.includes('v1.5 Flash'));
  assert.ok(sanitized.includes('9c2.io.vn'));
});

test('generateSessionTitle extracts clean text up to 28 chars with ellipsis', () => {
  assert.equal(generateSessionTitle(''), 'Phiên làm việc mới');
  assert.equal(generateSessionTitle('[System Note: uploaded image]'), 'Tập tin đa phương tiện');
  const longPrompt = 'Giải phương trình vi phân bậc hai có điều kiện biên';
  const title = generateSessionTitle(longPrompt);
  assert.ok(title.endsWith('...'));
  assert.ok(title.length <= 32);
});

test('buildEduPrompt appends custom user instructions when provided', () => {
  const prompt = buildEduPrompt('Giải bằng cách đặt ẩn phụ');
  assert.ok(prompt.includes('Vui lòng phân tích hình ảnh này'));
  assert.ok(prompt.includes('Giải bằng cách đặt ẩn phụ'));
});
