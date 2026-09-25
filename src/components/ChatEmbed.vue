<template>
  <div v-if="visible" class="ce-overlay" @click.self="$emit('close')">
    <div class="ce-panel" role="dialog" aria-label="在线客服">
      <header class="ce-head">
        <span class="ce-dot"></span>
        <span class="ce-title">在线客服 · 察元AI</span>
        <button class="ce-close" aria-label="关闭" @click="$emit('close')">✕</button>
      </header>

      <div v-if="state === 'probing'" class="ce-tip">正在连接在线客服…</div>

      <iframe
        v-else-if="state === 'online'"
        class="ce-frame"
        :src="chatUrl"
        title="在线客服"
        allow="clipboard-write; camera"
      ></iframe>

      <div v-else class="ce-offline">
        <img class="ce-qr" :src="qrcode" alt="微信公众号二维码" />
        <p class="ce-offline-title">当前网络不可用，无法打开在线客服</p>
        <p class="ce-offline-text">请用微信扫码关注公众号，与我们联系</p>
      </div>
    </div>
  </div>
</template>

<script>
// 在线客服嵌入（察元机器人聊天页）：iframe 嵌 aidooo.com/bot/chat（同一聊天界面，官网同款）。
// 离线兜底：打开前探测站点可达性（favicon，4.5s 超时）——离线展示本地打包的公众号二维码，
// 引导用户扫码找客服（聊天页自身在 iframe 内部处理断网提示，这里只挡"整页打不开"）。
const CHAT_URL = 'https://aidooo.com/bot/chat?embed=1&channel=wps'
const PROBE_URL = 'https://aidooo.com/favicon.ico'

export default {
  name: 'ChatEmbed',
  props: {
    visible: { type: Boolean, default: false }
  },
  data() {
    return { state: 'probing', chatUrl: CHAT_URL, qrcode: null }
  },
  watch: {
    visible(v) {
      if (v) this.probe()
    }
  },
  created() {
    // 二维码本地打包（离线可用）
    import('../assets/qrcode.png').then((m) => { this.qrcode = m.default }).catch(() => {})
  },
  methods: {
    async probe() {
      this.state = 'probing'
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.state = 'offline'
        return
      }
      const ok = await this.probeReachable()
      this.state = ok ? 'online' : 'offline'
    },
    probeReachable() {
      return new Promise((resolve) => {
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 4500)
          fetch(PROBE_URL + '?t=' + Date.now(), { mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' })
            .then(() => { clearTimeout(timer); resolve(true) })
            .catch(() => { clearTimeout(timer); resolve(false) })
        } catch { resolve(false) }
      })
    }
  }
}
</script>

<style scoped>
.ce-overlay { position: fixed; inset: 0; z-index: 4000; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; }
.ce-panel { width: 400px; height: 600px; max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); background: #f7f8fa; border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.25); }
.ce-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: linear-gradient(135deg, #2b5cff, #1e46d0); color: #fff; }
.ce-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.25); }
.ce-title { flex: 1; font-size: 13.5px; font-weight: 600; }
.ce-close { border: none; background: rgba(255, 255, 255, 0.15); color: #fff; border-radius: 6px; width: 22px; height: 22px; cursor: pointer; font-size: 12px; line-height: 1; }
.ce-frame { flex: 1; width: 100%; border: 0; background: #f7f8fa; }
.ce-tip { flex: 1; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 13px; }
.ce-offline { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 20px; text-align: center; }
.ce-qr { width: 168px; height: 168px; border-radius: 10px; border: 1px solid #e5e9f2; background: #fff; }
.ce-offline-title { font-size: 14px; font-weight: 600; color: #0f172a; margin: 4px 0 0; }
.ce-offline-text { font-size: 12.5px; color: #64748b; margin: 0; }
</style>
