import { describe, expect, it } from 'vitest';
import { shortcutLetter } from '@/lib/utils';

describe('shortcutLetter: the letter N and Ctrl K read from a key press', () => {
  it.each([
    ['English', 'n', 'KeyN', 'n'],
    ['English, with Shift', 'N', 'KeyN', 'n'],
    // a Latin layout goes by the letter, wherever the key is
    ['Dvorak, the N', 'n', 'KeyL', 'n'],
    ['Dvorak, the key where QWERTY has N', 'b', 'KeyN', 'b'],
    ['AZERTY, the K', 'k', 'KeyK', 'k'],
    // another script goes by the key
    ['Russian', 'т', 'KeyN', 'n'],
    ['Russian, with Shift', 'Т', 'KeyN', 'n'],
    ['Russian, the K', 'л', 'KeyK', 'k'],
    ['Arabic', 'ى', 'KeyN', 'n'],
    ['Arabic, the K', 'ن', 'KeyK', 'k'],
    ['Arabic, two letters on one key', 'لا', 'KeyB', 'b'],
    ['Hindi', 'ल', 'KeyN', 'n'],
    ['Hindi, the K', 'क', 'KeyK', 'k'],
    ['Hindi, a vowel sign', 'ा', 'KeyE', 'e'],
  ])('%s: %s on %s is %s', (_, key, code, letter) => {
    expect(shortcutLetter({ key, code, altKey: false })).toBe(letter);
  });

  it('with Alt held goes by the letter only, so AltGr can still type its own characters', () => {
    // US-International: AltGr+K types "œ" and arrives as Ctrl+Alt, which is not Ctrl K
    expect(shortcutLetter({ key: 'œ', code: 'KeyK', altKey: true })).toBeNull();
    expect(shortcutLetter({ key: 'л', code: 'KeyK', altKey: true })).toBeNull();
    expect(shortcutLetter({ key: 'k', code: 'KeyK', altKey: true })).toBe('k');
  });

  it.each([
    ['Enter', 'Enter', 'Enter'],
    ['an input method composing', 'Process', 'KeyN'],
    ['a dead key', 'Dead', 'KeyN'],
    ['a digit', '1', 'Digit1'],
    ['the search slash', '/', 'Slash'],
    ['a Russian letter on no letter key', 'ж', 'Semicolon'],
    ['a Spanish letter of its own', 'ñ', 'Semicolon'],
  ])('%s is no letter', (_, key, code) => {
    expect(shortcutLetter({ key, code, altKey: false })).toBeNull();
  });
});
