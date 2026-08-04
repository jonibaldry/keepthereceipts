<img src="frontend/public/logo.svg" alt="keepthereceipts.net" height="48" />

# Overview

This project is an open source distributed document repository which can be copied by anybody, anonymously and even on a laptop.

* The data store is backed by IPFS with MFS on top.
* The latest root of the datastore is published via DNSLink
* All documents are indexed in an sqlite3 database called vault.db
* The latest vault.db is published via DNSLink
* The latest vault.db is replicated from a local to the repository using litestream
* A web based front-end allows end users to upload documents to the repository

# Implementation

## Database

The repository is indexed in a single SQLite database (`vault.db`), run in WAL mode. Two independent processes consume it, each with a different job:

1. **`litestream`** continuously streams the SQLite WAL to a local file replica (`data/replica`). This gives durability / point-in-time recovery and runs constantly in the background — it has no concept of a finished "snapshot," it's just an ongoing stream.
2. **`snapshotter`** runs on a fixed interval (`SNAPSHOT_INTERVAL`, default 60s). Each tick it takes a consistent online backup of the live database using SQLite's own `.backup` command (safe to run against a live, in-use database), then hashes the result. If the hash hasn't changed since the last run, it skips the rest of the cycle — no redundant writes to IPFS. If it has changed, the backup is added to IPFS and published into MFS at `/vault/vault.db`, replacing whatever was there. Only the latest snapshot is kept in MFS — there's no history of older ones here; litestream's WAL replica is the durability/point-in-time-recovery story, this is just "what's the current, content-addressed state of the database." The previous snapshot's CID is unpinned once it's replaced, so it's eligible for `ipfs repo gc` to reclaim.

The MFS root produced by that second step (`ipfs files stat --hash /`) is the value published via DNSLink, so consumers always resolve to the most recently completed, self-consistent snapshot of the database — never a partial write.

These two processes are deliberately kept separate: litestream's WAL streaming is continuous and has no natural "replication finished" event to hook into, so it isn't a good source for a content-addressed root. The snapshotter exists specifically to produce discrete, well-defined states that IPFS/MFS/DNSLink can point at.

Users are referenced by a unique URI that includes their source domain e.g. https://keepthereceipts.com/api/v1/users/<user_id>. Details of the user themselves are not stored in the vault database.

All ids are "Stripe ID" style IDs generated using typeid-js.

## UI

The platform includes a management web application. This is a Tanstack Start/Tanstack Query/Nitro/React with file-based routing and a preference for SSR to make the client as lightweight as possible.

The UI has its own separate SQLite database which contains a hand-rolled users table. We store (but don't display to other users) an email address in addition to the user name and password (bcrypt encoded). Sessions are managed via JWT stored in a session cookie.

We're using the following packages:

* tailwind
* bcryptjs
* better-sqlite3
* jose
* react
* react-dom
* vitest
* playwright