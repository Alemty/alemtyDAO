## Backend Architecture – alemtyDAO
### Overview

This document defines the **persistent backend design** for alemtyDAO. The backend is responsible for **shared state**, **auth‑gated writes**, and **data integrity**, while the frontend remains fully static and served from IPFS. 
Core stack:
- Cloudflare Workers
- Hono (TypeScript)
- Cloudflare D1 (SQLite)
- SIWE (Sign‑In With Ethereum)
### Design Principles
- Wallet address = canonical identity
- No accounts, no passwords, no emails
- All writes require SIWE verification
- Frontend is stateless
- Backend is replaceable, deterministic, and auditable
### Identity & Authentication Flow
- User signs SIWE message in the browser
- SIWE Worker verifies:
- domain
- chain allowlist
- nonce (KV, TTL)
- signature
- Worker issues a **session token**
- Frontend sends token in Authorization header
- Backend Worker validates session before writes
### Database (Cloudflare D1)
#### users

Stores wallets that have authenticated at least once.
CREATE TABLE users (
 address TEXT PRIMARY KEY,
 ens TEXT,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
#### posts

DAO discussion threads.
CREATE TABLE posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 author TEXT NOT NULL,
 title TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (author) REFERENCES users(address)
);
#### comments

Replies attached to posts.
CREATE TABLE comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL,
 author TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (post_id) REFERENCES posts(id),
 FOREIGN KEY (author) REFERENCES users(address)
);
#### reactions

Generic reactions (likes, points, karma).
CREATE TABLE reactions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 post_id INTEGER NOT NULL,
 address TEXT NOT NULL,
 type TEXT NOT NULL,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (post_id) REFERENCES posts(id),
 FOREIGN KEY (address) REFERENCES users(address)
); 

Anti‑spam / toggle rule:
CREATE UNIQUE INDEX uniq_reaction
ON reactions (post_id, address, type);
### API Endpoints

All endpoints are JSON.
All POST requests require SIWE auth.
#### Posts
- GET /api/posts
- POST /api/posts
#### Comments
- GET /api/posts/:id/comments
- POST /api/posts/:id/comments
#### Reactions
- POST /api/posts/:id/like
- POST /api/posts/:id/point
#### Stats
- GET /api/posts/:id/stats
### Worker Responsibilities
- Verify SIWE session
- Enforce permissions
- Insert or query D1
- Never store private keys
### Explicit Non‑Goals (v0)
- Smart contracts
- On‑chain governance
- Token minting
- Moderation tools
- Role systems
### Migration Path

v0.1 – DAO persistence
v0.2 – Reputation & karma logic
v0.3 – On‑chain attestations
v1.0 – Hybrid on/off‑chain governance 
This backend is the **single source of truth** for DAO state.
Frontend modules are consumers only.


---

## v0.4 notes
- Auth: JWT via SIWE worker; API verifies with JWT_SECRET.
- Reactions endpoint uses type=like|point and normalizes points→point.
