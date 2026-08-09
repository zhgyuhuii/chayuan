/**
 * Minimal WebSocket upgrade + text echo for spike probing (no external deps).
 */
import crypto from 'node:crypto'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

export function isWebSocketUpgrade(req) {
  const upgrade = String(req.headers.upgrade || '').toLowerCase()
  const conn = String(req.headers.connection || '').toLowerCase()
  return upgrade === 'websocket' && conn.includes('upgrade')
}

function sendText(socket, text) {
  const payload = Buffer.from(String(text), 'utf8')
  if (payload.length < 126) {
    const frame = Buffer.alloc(2 + payload.length)
    frame[0] = 0x81
    frame[1] = payload.length
    payload.copy(frame, 2)
    socket.write(frame)
    return
  }
  const frame = Buffer.alloc(4 + payload.length)
  frame[0] = 0x81
  frame[1] = 126
  frame.writeUInt16BE(payload.length, 2)
  payload.copy(frame, 4)
  socket.write(frame)
}

export function acceptWebSocket(req, socket, head) {
  const key = req.headers['sec-websocket-key']
  if (!key) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    return null
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64')
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n` +
    '\r\n'
  )
  if (head && head.length) socket.unshift(head)

  socket.on('error', () => {
    try { socket.destroy() } catch { /* ignore */ }
  })

  let buffer = Buffer.alloc(0)
  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f
      const masked = (buffer[1] & 0x80) !== 0
      let len = buffer[1] & 0x7f
      let offset = 2
      if (len === 126) {
        if (buffer.length < 4) return
        len = buffer.readUInt16BE(2)
        offset = 4
      } else if (len === 127) {
        socket.destroy()
        return
      }
      const maskLen = masked ? 4 : 0
      if (buffer.length < offset + maskLen + len) return

      const mask = masked ? buffer.subarray(offset, offset + 4) : null
      let payload = Buffer.from(buffer.subarray(offset + maskLen, offset + maskLen + len))
      buffer = buffer.subarray(offset + maskLen + len)

      if (mask) {
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4]
      }

      if (opcode === 0x8) {
        socket.end()
        return
      }
      if (opcode === 0x9) {
        // pong
        const pong = Buffer.alloc(2 + payload.length)
        pong[0] = 0x8a
        pong[1] = payload.length
        payload.copy(pong, 2)
        socket.write(pong)
        continue
      }
      if (opcode === 0x1) {
        const text = payload.toString('utf8')
        sendText(socket, JSON.stringify({ type: 'pong', echo: text, t: Date.now() }))
      }
    }
  })

  sendText(socket, JSON.stringify({ type: 'hello', service: 'chayuan-mcp', t: Date.now() }))
  return { socket }
}
