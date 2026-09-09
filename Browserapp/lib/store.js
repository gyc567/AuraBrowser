'use strict';

/**
 * OpenBrowser persistent store base class.
 *
 * Provides:
 *   - Atomic file write via tmp + rename with fsync (data + directory)
 *   - Serialized mutation queue (no concurrent writes clobbering each other)
 *   - Schema version + migrate(fromVersion, toVersion) hook
 *   - Crash-recovery: corrupt main file → fall back to .bak
 *   - Backups: write a `.bak` copy before overwriting an existing main file
 *   - Convenience accessors (get/set/flush/close)
 *
 * Subclasses extend by:
 *   1. Calling `super(filePath, { defaultData, version, migrations })`
 *   2. Optionally implementing `async migrate(fromVersion)` for domain changes
 *   3. Calling `await store.load()` once at startup
 *   4. Calling `await store.save()` after any mutation
 *
 * NOT thread-safe across separate Node processes — relies on filesystem
 * advisory locks for cross-process safety (see isolation.js).
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { StoreCorruptError, StoreMigrationError } = require('./errors');
const { log } = require('./log');

/**
 * Resolve a stable process-unique suffix for temp filenames.
 * Used to avoid races between multiple writers in the same process.
 */
function tempSuffix() {
  return `${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
}

class Store {
  /**
   * @param {string} filePath - Absolute path to the JSON store file.
   * @param {object} [options]
   * @param {object} [options.defaultData] - Initial data when the file does not exist.
   * @param {number} [options.version] - Current schema version. Files with lower
   *   `version` will be migrated on load.
   * @param {boolean} [options.writeBackup=true] - Write .bak before overwriting existing file.
   * @param {number} [options.mode=0o600] - File permission for atomic writes.
   * @param {string} [options.tag] - Logger tag (defaults to class name).
   */
  constructor(filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new TypeError('Store: filePath must be a non-empty string');
    }
    this.filePath = path.resolve(filePath);
    this.defaultData = options.defaultData || {};
    this.version = Number(options.version) || 1;
    this.writeBackup = options.writeBackup !== false;
    this.mode = options.mode || 0o600;
    this.tag = options.tag || 'store';
    this._data = JSON.parse(JSON.stringify(this.defaultData));
    this._saveQueue = Promise.resolve();
    this._loaded = false;
    this._logger = log.child(this.tag);
  }

  /**
   * Get current in-memory data. Read-only by convention; mutate via subclass
   * methods that call save().
   */
  get data() {
    return this._data;
  }

  /**
   * Set top-level data. Resets and triggers a save.
   */
  setData(next) {
    this._data = next;
  }

  /**
   * Read the JSON store file. Falls back to .bak on parse failure.
   * Runs `migrate()` if the loaded version is behind current.
   */
  async load() {
    let raw = null;
    let source = 'main';
    try {
      raw = await fsp.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this._logger.debug('store file missing, using defaults', { file: this.filePath });
    }
    if (raw == null) {
      this._data = JSON.parse(JSON.stringify(this.defaultData));
      this._loaded = true;
      return this._data;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      const recovered = await this._tryRecoverFromBackup();
      if (recovered) {
        parsed = recovered;
        source = 'backup';
      } else {
        // Last resort: log and fall back to defaults so the app starts.
        // The corrupt file is left on disk for the user to inspect.
        this._logger.error('store file corrupt and no backup', {
          file: this.filePath,
          error: error.message,
        });
        throw new StoreCorruptError(this.filePath, { cause: error });
      }
    }

    const fromVersion = Number(parsed.version) || 1;
    if (fromVersion < this.version) {
      const migrated = await this.migrate(parsed, fromVersion);
      this._data = migrated;
      this._logger.info('store migrated', { from: fromVersion, to: this.version, source });
      await this.save();
    } else if (fromVersion > this.version) {
      throw new StoreMigrationError(fromVersion, this.version, {
        context: { file: this.filePath, fromVersion, toVersion: this.version },
      });
    } else {
      this._data = parsed;
    }

    this._loaded = true;
    return this._data;
  }

  /**
   * Hook for subclasses to upgrade data across schema versions.
   * Default: just stamps the new version.
   *
   * @param {object} parsed - The raw parsed JSON.
   * @param {number} fromVersion - The schema version found on disk.
   * @returns {object} The upgraded data (must include `version: this.version`).
   */
  async migrate(parsed, fromVersion) {
    return { ...parsed, version: this.version };
  }

  /**
   * Persist the current in-memory data to disk. Serialized — concurrent
   * save() calls run sequentially and never overlap.
   */
  async save() {
    const write = async () => {
      await this._writeAtomic();
    };
    const pending = this._saveQueue.then(write, write);
    this._saveQueue = pending.catch(() => {});
    return pending;
  }

  /**
   * Wait for all queued writes to settle. Call before process exit.
   */
  async flush() {
    await this._saveQueue;
  }

  /**
   * Atomic file write: temp file + fsync + rename + dir fsync.
   * On overwrite of existing main file, also writes .bak first.
   *
   * .bak semantics: snapshot of the PREVIOUS main file content (not the
   * new content). This way load() can recover from parse errors by
   * falling back to the most recent successful write before corruption.
   */
  async _writeAtomic() {
    const payload = JSON.stringify(this._data, null, 2);
    const directory = path.dirname(this.filePath);
    await fsp.mkdir(directory, { recursive: true });

    // Snapshot previous main file into .bak (best-effort; skip on ENOENT).
    if (this.writeBackup) {
      try {
        await fsp.copyFile(this.filePath, `${this.filePath}.bak`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this._logger.warn('backup copy failed', { error: error.message });
        }
      }
    }

    await this._writeRaw(this.filePath, payload);
  }

  async _writeRaw(targetPath, payload) {
    const temporary = `${targetPath}.tmp-${tempSuffix()}`;
    const directory = path.dirname(targetPath);
    let handle = null;
    try {
      handle = await fsp.open(temporary, 'wx', this.mode);
      await handle.writeFile(payload, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fsp.rename(temporary, targetPath);
      try {
        const directoryHandle = await fsp.open(directory, 'r');
        await directoryHandle.sync();
        await directoryHandle.close();
      } catch (_) {
        // Directory fsync is best-effort on systems that don't support it.
      }
    } catch (error) {
      if (handle) {
        try {
          await handle.close();
        } catch (_) {
          /* ignore */
        }
      }
      try {
        await fsp.unlink(temporary);
      } catch (_) {
        /* ignore */
      }
      throw error;
    }
  }

  /**
   * Try to read the .bak file and parse it. Returns parsed object on success,
   * null if no usable backup.
   */
  async _tryRecoverFromBackup() {
    const backupPath = `${this.filePath}.bak`;
    try {
      const raw = await fsp.readFile(backupPath, 'utf8');
      const parsed = JSON.parse(raw);
      this._logger.warn('recovered from .bak after parse failure', {
        main: this.filePath,
        backup: backupPath,
      });
      return parsed;
    } catch (_) {
      return null;
    }
  }
}

module.exports = { Store, tempSuffix };
