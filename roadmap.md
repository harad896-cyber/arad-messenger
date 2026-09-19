# Roadmap — Arad Messenger production rebuild

## Phase 1 — Foundation
- [ ] Enable Lovable Cloud (auth, database, storage, realtime)
- [ ] Database schema: profiles, contacts, conversations, members/roles, messages, reactions, reads, invites, bans, call sessions
- [ ] RLS + grants for every table
- [ ] Storage buckets: avatars, voice, attachments
- [ ] Refactor monolithic index.tsx into features/ modules, hooks, typed interfaces
- [ ] Real routes: /auth, /, /chat/$id, /chat/$id/info, /contacts, /settings

## Phase 2 — Chat
- [ ] Auth screens + session persistence + protected shell
- [ ] Conversation list: unread, last message, debounced search, presence
- [ ] Chat screen: header, pinned, day dividers, RTL scroll anchoring
- [ ] Reply, edit, delete-for-me, delete-for-all, reactions, forward, in-chat search, attachments
- [ ] Loading/empty/offline/error states + error boundaries

## Phase 3 — Voice & audio
- [ ] Real mic recording: permission, record, cancel, preview, waveform, send
- [ ] Shared audio player: play/pause, seek, progress, duration, 0.5x-2x, single-playback, crash-free errors
- [ ] Audio/music file upload + playback

## Phase 4 — Groups, contacts, notifications
- [ ] Create group (name, bio, avatar), add/remove members, admin roles, invite links, leave, bans, settings
- [ ] Contacts: user search, start chat, presence/last seen, block
- [ ] Unread badges, mute, in-app notifications

## Phase 5 — Calls
- [ ] WebRTC abstraction + realtime signalling
- [ ] Call UI: incoming/outgoing, permissions, mute, speaker, camera, hangup, reconnect/failed
- [ ] TURN credential plug point (blocked: needs TURN credentials for mobile networks)

## Phase 6 — Polish & verification
- [ ] Mobile safe-area, keyboard-aware composer, no overflow, touch targets
- [ ] Validation, file limits, image compression, leak cleanup, memoization
- [ ] Accessibility: keyboard nav, focus, contrast
- [ ] Build, lint, type-check, runtime + preview validation on mobile and desktop