// §62 vitest unit. Pins the chat-list invariant violated by the pre-fix
// `prev.find(c => c.id === 'my-workpal')!` non-null-assert: if `prev` lacked
// the my-workpal welcome chat (returning user, cloud-only state, etc.), the
// spread silently pushed `undefined` into the array and crashed the dirty-
// detection useEffect on the next commit — sidebar never rendered the new
// chat, no PUT fired, but the streaming path had already kicked off so the
// usage_log row landed anyway. Hence the §60 PR #201 verify triple symptom.

import { describe, expect, it } from 'vitest';

import { pinMyWorkPalToEnd } from './chatStore';
import type { Chat } from '../types';

const myWorkPal: Chat = {
  id: 'my-workpal',
  title: 'My WorkPal',
  lastMessage: 'How can I help you today?',
  timestamp: new Date('2026-04-01T00:00:00Z'),
  messages: [],
};

const otherChat: Chat = {
  id: 'chat-other',
  title: 'Other',
  lastMessage: 'hi',
  timestamp: new Date('2026-04-15T00:00:00Z'),
  messages: [],
};

const newChat: Chat = {
  id: 'chat-new',
  title: 'testing 62',
  lastMessage: 'testing 62',
  timestamp: new Date('2026-05-05T19:25:59Z'),
  messages: [],
};

describe('pinMyWorkPalToEnd', () => {
  it('returns [newChat, ...others] when prev does not contain my-workpal (regression: triple-symptom bug)', () => {
    const prev: Chat[] = [otherChat];
    const result = pinMyWorkPalToEnd(prev, newChat);
    expect(result).toEqual([newChat, otherChat]);
    expect(result).not.toContain(undefined);
    expect(result.every((c) => c && typeof c.id === 'string')).toBe(true);
  });

  it('puts my-workpal at the end when prev contains it', () => {
    const prev: Chat[] = [otherChat, myWorkPal];
    const result = pinMyWorkPalToEnd(prev, newChat);
    expect(result).toEqual([newChat, otherChat, myWorkPal]);
    expect(result[result.length - 1].id).toBe('my-workpal');
  });

  it('handles empty prev (fresh user, no cache, no cloud) without producing undefined', () => {
    const prev: Chat[] = [];
    const result = pinMyWorkPalToEnd(prev, newChat);
    expect(result).toEqual([newChat]);
    expect(result.length).toBe(1);
    expect(result[0]).toBe(newChat);
  });

  it('preserves order of non-my-workpal chats (newChat first, others by their input order, my-workpal last)', () => {
    const earlier: Chat = { ...otherChat, id: 'chat-earlier' };
    const later: Chat = { ...otherChat, id: 'chat-later' };
    const prev: Chat[] = [earlier, myWorkPal, later];
    const result = pinMyWorkPalToEnd(prev, newChat);
    expect(result.map((c) => c.id)).toEqual(['chat-new', 'chat-earlier', 'chat-later', 'my-workpal']);
  });
});
