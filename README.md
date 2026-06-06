# Proof of Concept: Mastodon External Accounts Feed

## Challenge

Combine posts from accounts from multiple (trusted) sources in one feed.

Create feeds with only selected accounts (not all local accounts).

## Restrictions

Keep it simple.

No backend.

## Solution

Single page app that uses Mastodon API to load posts from accounts from multiple (trusted) sources in one feed.

Implements read-through caching with IndexedDB (5-minute TTL) to minimize API calls while keeping data fresh.

Can be run on (for example) Github Pages.
