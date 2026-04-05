import { saveActiveDocumentWithPassword, saveActiveDocumentWithoutPassword } from './documentFileActions.js'

export function encryptActiveDocument(options = {}) {
  const password = String(options.password || '').trim()
  if (!password) throw new Error('请提供文档密码')
  return saveActiveDocumentWithPassword(password, options.savePath || '')
}

export function decryptActiveDocument(options = {}) {
  return saveActiveDocumentWithoutPassword(options.savePath || '')
}
