/**
 * opfsStorage — Origin Private File System 大文件存储
 *
 * 解决 P6 问题:写大文件依赖 PluginStorage(WPS COM)或 localStorage,
 * 限制太多。Web 平台原生有 OPFS,无配额上限,Chrome/Edge/Firefox/Safari 均支持。
 *
 * 用法:
 *   import opfs from '@/utils/host/opfsStorage.js'
 *
 *   await opfs.writeFile('chat-history-2026.json', jsonString)
 *   const text = await opfs.readFile('chat-history-2026.json')
 *   await opfs.deleteFile('old.json')
 *   const list = await opfs.listFiles()
 *
 * 不可用环境(老浏览器 / 服务端)→ fallback 到 IndexedDB blob 存储。
 */

const FALLBACK_DB = 'chayuanOpfsFallback'
const FALLBACK_STORE = 'files'

let _fallbackDB = null

async function getOpfsRoot() {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) return null
  try {
    return await navigator.storage.getDirectory()
  } catch { return null }
}

/* ────────── OPFS 路径(主路径) ────────── */

export async function writeFile(name, content) {
  const root = await getOpfsRoot()
  if (root) {
    try {
      const handle = await root.getFileHandle(name, { create: true })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      return { ok: true, backend: 'opfs', size: content.length }
    } catch (e) {
      // OPFS write failed → fallback
    }
  }
  return writeFileFallback(name, content)
}

export async function readFile(name) {
  const root = await getOpfsRoot()
  if (root) {
    try {
      const handle = await root.getFileHandle(name)
      const file = await handle.getFile()
      return await file.text()
    } catch (e) {
      // not in OPFS → 试 fallback
    }
  }
  return readFileFallback(name)
}

export async function deleteFile(name) {
  const root = await getOpfsRoot()
  if (root) {
    try {
      await root.removeEntry(name)
      return { ok: true, backend: 'opfs' }
    } catch (e) { /* fall through */ }
  }
  return deleteFileFallback(name)
}

export async function listFiles() {
  const root = await getOpfsRoot()
  if (root && typeof root.entries === 'function') {
    const out = []
    try {
      for await (const [name, handle] of root.entries()) {
        if (handle.kind === 'file') out.push(name)
      }
      return out
    } catch (_) {}
  }
  return listFilesFallback()
}

/* ────────── IndexedDB fallback ────────── */

async function getFallbackDB() {
  if (_fallbackDB) return _fallbackDB
  if (typeof indexedDB === 'undefined') return null
  _fallbackDB = await new Promise((resolve, reject) => {
    const req = indexedDB.open(FALLBACK_DB, 1)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(FALLBACK_STORE)) {
        db.createObjectStore(FALLBACK_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch(() => null)
  return _fallbackDB
}

async function withFallbackStore(mode, fn) {
  const db = await getFallbackDB()
  if (!db) return null
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FALLBACK_STORE, mode)
    const store = tx.objectStore(FALLBACK_STORE)
    const out = fn(store)
    tx.oncomplete = () => resolve(out)
    tx.onerror = () => reject(tx.error)
  })
}

async function writeFileFallback(name, content) {
  const ok = await withFallbackStore('readwrite', (store) => {
    store.put(content, name)
    return true
  })
  return ok ? { ok: true, backend: 'idb-fallback', size: content.length } : { ok: false, backend: 'none' }
}

async function readFileFallback(name) {
  return withFallbackStore('readonly', (store) => {
    return new Promise((resolve) => {
      const req = store.get(name)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  })
}

async function deleteFileFallback(name) {
  const ok = await withFallbackStore('readwrite', (store) => {
    store.delete(name)
    return true
  })
  return ok ? { ok: true, backend: 'idb-fallback' } : { ok: false, backend: 'none' }
}

async function listFilesFallback() {
  return withFallbackStore('readonly', (store) => {
    return new Promise((resolve) => {
      const out = []
      const req = store.openKeyCursor()
      req.onsuccess = (e) => {
        const cursor = e.target.result
        if (!cursor) { resolve(out); return }
        out.push(String(cursor.key))
        cursor.continue()
      }
      req.onerror = () => resolve(out)
    })
  }) || []
}

/* ────────── 容量检查 ────────── */

export async function getStorageEstimate() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  try {
    const e = await navigator.storage.estimate()
    return {
      usage: e.usage || 0,
      quota: e.quota || 0,
      usagePct: e.quota ? Math.round((e.usage / e.quota) * 100) : 0
    }
  } catch { return null }
}

export default {
  writeFile,
  readFile,
  deleteFile,
  listFiles,
  getStorageEstimate
}
