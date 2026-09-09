'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { Store } = require('../../Browserapp/lib/store');
const { StoreCorruptError, StoreMigrationError } = require('../../Browserapp/lib/errors');

async function makeTmp() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'store-test-'));
}

async function writeRaw(filePath, payload) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, payload, 'utf8');
}

test('Store: load() creates defaults when file is missing', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const store = new Store(path.join(tmp, 'sub', 'data.json'), {
    defaultData: { version: 1, items: [] },
    version: 1,
  });
  const data = await store.load();
  assert.deepEqual(data, { version: 1, items: [] });
  assert.equal(store.data, data);
});

test('Store: load() parses existing JSON', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  await writeRaw(path.join(tmp, 'data.json'), JSON.stringify({ version: 1, items: ['a'] }));
  const store = new Store(path.join(tmp, 'data.json'), {
    defaultData: { version: 1, items: [] },
    version: 1,
  });
  const data = await store.load();
  assert.deepEqual(data, { version: 1, items: ['a'] });
});

test('Store: load() runs migrate() when loaded version is older', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  await writeRaw(filePath, JSON.stringify({ version: 1, items: ['a'] }));

  let migrateFromVersion = null;
  let migrateParsed = null;
  class V2Store extends Store {
    async migrate(parsed, fromVersion) {
      migrateFromVersion = fromVersion;
      migrateParsed = parsed;
      return { version: 2, items: parsed.items, added: 'field' };
    }
  }
  const store = new V2Store(filePath, {
    defaultData: { version: 2, items: [] },
    version: 2,
  });
  await store.load();
  assert.equal(migrateFromVersion, 1);
  assert.deepEqual(migrateParsed, { version: 1, items: ['a'] });
  assert.equal(store.data.version, 2);
  assert.equal(store.data.added, 'field');
});

test('Store: load() persists migrated data immediately', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  await writeRaw(filePath, JSON.stringify({ version: 1, items: ['a'] }));

  class V2Store extends Store {
    async migrate(parsed) {
      return { version: 2, items: parsed.items, added: 'field' };
    }
  }
  const store = new V2Store(filePath, { defaultData: { version: 2, items: [] }, version: 2 });
  await store.load();
  // Re-read from disk; should now be v2.
  const raw = await fsp.readFile(filePath, 'utf8');
  const onDisk = JSON.parse(raw);
  assert.equal(onDisk.version, 2);
  assert.equal(onDisk.added, 'field');
});

test('Store: load() throws StoreMigrationError when loaded version is NEWER', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  await writeRaw(filePath, JSON.stringify({ version: 5, items: [] }));
  const store = new Store(filePath, { defaultData: { version: 2, items: [] }, version: 2 });
  await assert.rejects(store.load(), (err) => {
    assert.ok(
      err instanceof StoreMigrationError,
      `expected StoreMigrationError, got ${err?.constructor?.name}`
    );
    assert.equal(err.context.fromVersion, 5);
    assert.equal(err.context.toVersion, 2);
    return true;
  });
});

test('Store: load() throws StoreCorruptError when main + .bak are both broken', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  await writeRaw(filePath, '{ this is not valid json }');
  await writeRaw(filePath + '.bak', '{ also not valid }');
  const store = new Store(filePath, { defaultData: { version: 1, items: [] }, version: 1 });
  await assert.rejects(store.load(), (err) => {
    assert.ok(err instanceof StoreCorruptError, `expected StoreCorruptError, got ${err?.constructor?.name}`);
    assert.equal(err.context.storePath, filePath);
    return true;
  });
});

test('Store: load() falls back to .bak when main file is corrupt', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  await writeRaw(filePath, '{ broken');
  await writeRaw(filePath + '.bak', JSON.stringify({ version: 1, items: ['backup'] }));
  const store = new Store(filePath, { defaultData: { version: 1, items: [] }, version: 1 });
  const data = await store.load();
  assert.deepEqual(data, { version: 1, items: ['backup'] });
});

test('Store: save() writes JSON to disk', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  const store = new Store(filePath, { defaultData: { version: 1, items: [] }, version: 1 });
  await store.load();
  store.setData({ version: 1, items: ['x', 'y'] });
  await store.save();
  const raw = await fsp.readFile(filePath, 'utf8');
  const onDisk = JSON.parse(raw);
  assert.deepEqual(onDisk, { version: 1, items: ['x', 'y'] });
});

test('Store: save() writes .bak before overwriting existing main file', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  await writeRaw(filePath, JSON.stringify({ version: 1, items: ['original'] }));

  const store = new Store(filePath, { defaultData: { version: 1, items: [] }, version: 1 });
  await store.load();
  store.setData({ version: 1, items: ['updated'] });
  await store.save();

  const main = JSON.parse(await fsp.readFile(filePath, 'utf8'));
  const backup = JSON.parse(await fsp.readFile(filePath + '.bak', 'utf8'));
  assert.deepEqual(main.items, ['updated']);
  assert.deepEqual(backup.items, ['original']);
});

test('Store: save() skips .bak when writeBackup=false', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  await writeRaw(filePath, JSON.stringify({ version: 1, items: ['a'] }));

  const store = new Store(filePath, {
    defaultData: { version: 1, items: [] },
    version: 1,
    writeBackup: false,
  });
  await store.load();
  store.setData({ version: 1, items: ['b'] });
  await store.save();

  await assert.rejects(fsp.access(filePath + '.bak'));
});

test('Store: concurrent save() calls serialize (last write wins, no corruption)', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');

  const store = new Store(filePath, { defaultData: { version: 1, items: [] }, version: 1 });
  await store.load();

  // Issue 10 concurrent writes with different content.
  await Promise.all(
    Array.from({ length: 10 }, (_, i) => {
      store.setData({ version: 1, items: [`writer-${i}`] });
      return store.save();
    })
  );

  // No temp files left behind.
  const entries = await fsp.readdir(tmp);
  const temps = entries.filter((name) => name.includes('.tmp-'));
  assert.equal(temps.length, 0, `leftover temp files: ${temps.join(', ')}`);

  // File parses cleanly.
  const raw = await fsp.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  assert.ok(parsed.items[0].startsWith('writer-'));
});

test('Store: flush() waits for in-flight writes', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const filePath = path.join(tmp, 'data.json');
  const store = new Store(filePath, { defaultData: { version: 1, items: [] }, version: 1 });
  await store.load();

  store.setData({ version: 1, items: ['pending'] });
  store.save(); // not awaited
  await store.flush();
  const raw = await fsp.readFile(filePath, 'utf8');
  assert.deepEqual(JSON.parse(raw), { version: 1, items: ['pending'] });
});

test('Store: throws TypeError when constructed without filePath', () => {
  assert.throws(() => new Store(), TypeError);
  assert.throws(() => new Store(''), TypeError);
  assert.throws(() => new Store(null), TypeError);
});

test('Store: data field is read-only by convention but settable via setData', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  const store = new Store(path.join(tmp, 'd.json'), {
    defaultData: { x: 1 },
    version: 1,
  });
  await store.load();
  // Direct assignment to .data is allowed (subclasses may do this internally).
  store.data.y = 2;
  assert.equal(store.data.y, 2);
});

test('Store: subclass override of save() can extend (e.g. enforce budget)', async (t) => {
  const tmp = await makeTmp();
  t.after(() => fsp.rm(tmp, { recursive: true, force: true }));
  let budgetCalled = false;
  class BudgetStore extends Store {
    async _writeAtomic() {
      budgetCalled = true;
      await super._writeAtomic();
    }
  }
  const store = new BudgetStore(path.join(tmp, 'd.json'), {
    defaultData: { items: [] },
    version: 1,
  });
  await store.load();
  await store.save();
  assert.equal(budgetCalled, true);
});
