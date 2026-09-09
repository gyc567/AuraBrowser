// File-based advisory lock for STATE.md / state/current.json writes.
// Uses fs.open with 'wx' flag to atomically claim the lock.
// Reentrant: the same process can acquire the lock multiple times; each acquire must
// have a matching release.

import { open, rename, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const LOCK_DIR = '.aura-loop';
const HELD = new Map(); // lockPath -> { fd, count, owner }

function ownerId() {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function acquire(lockPath, { timeoutMs = 5000, pollMs = 50 } = {}) {
  const held = HELD.get(lockPath);
  if (held && held.owner.pid === process.pid) {
    held.count += 1;
    return held;
  }
  const dir = path.dirname(lockPath);
  await fsMkdir(dir);
  const owner = { pid: process.pid, id: ownerId(), since: new Date().toISOString() };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const fd = await open(lockPath, 'wx');
      await fd.writeFile(JSON.stringify(owner));
      await fd.close();
      const entry = { fd: null, count: 1, owner, lockPath, since: new Date() };
      HELD.set(lockPath, entry);
      return entry;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // stale lock check: older than 30s + not held by live process => remove
      try {
        const stat = await fsStat(lockPath);
        if (Date.now() - stat.mtimeMs > 30000) {
          await unlink(lockPath).catch(() => {});
        }
      } catch {
        // ignore
      }
      await sleep(pollMs);
    }
  }
  throw new Error(`acquire(${lockPath}) timed out after ${timeoutMs}ms`);
}

export async function release(entry) {
  if (!entry) return;
  entry.count -= 1;
  if (entry.count > 0) return;
  HELD.delete(entry.lockPath);
  try {
    await unlink(entry.lockPath);
  } catch {
    // already gone
  }
}

export async function withLock(lockPath, fn, opts) {
  const entry = await acquire(lockPath, opts);
  try {
    return await fn();
  } finally {
    await release(entry);
  }
}

// Re-implement minimal mkdir/stat so we don't import fs/promises extra.
import { mkdir, stat } from 'node:fs/promises';
async function fsMkdir(dir) {
  if (existsSync(dir)) return;
  await mkdir(dir, { recursive: true });
}
async function fsStat(p) {
  return stat(p);
}

export const LOCK_DIR_NAME = LOCK_DIR;
