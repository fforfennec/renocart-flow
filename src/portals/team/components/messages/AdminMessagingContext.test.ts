import { describe, expect, it } from 'vitest';
import { InboxMessage, unreadMessages } from './AdminMessagingContext';
const msg = (id: string, incoming: boolean, date: string, type: 'supplier' | 'client' = 'client'): InboxMessage => ({ id, key: `${type}:thread`, type, target: 'thread', name: 'Client', content: 'Bonjour', created_at: date, incoming });
describe('unread message counts', () => {
  it('counts received messages rather than conversations, excluding outgoing messages', () => {
    expect(unreadMessages([msg('1', true, '2026-10-14T10:00:00Z'), msg('2', true, '2026-10-14T11:00:00Z'), msg('3', false, '2026-10-14T12:00:00Z')], {})).toHaveLength(2);
  });
  it('keeps unread incoming messages even when a later team reply exists', () => {
    expect(unreadMessages([msg('1', true, '2026-10-14T11:00:00Z'), msg('2', false, '2026-10-14T12:00:00Z')], { 'client:thread': '2026-10-14T10:00:00Z' })).toHaveLength(1);
  });
  it('separates client and supplier reads and ignores read messages', () => {
    expect(unreadMessages([msg('1', true, '2026-10-14T11:00:00Z'), msg('2', true, '2026-10-14T11:00:00Z', 'supplier')], { 'client:thread': '2026-10-14T11:00:00Z' }).map(m => m.id)).toEqual(['2']);
  });
});
