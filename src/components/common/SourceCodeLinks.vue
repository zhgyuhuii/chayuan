<template>
  <span class="source-code-links" :class="{ 'source-code-links--light': light }">
    <span class="source-code-links-label">获取源码</span>
    <a
      class="source-code-links-btn"
      href="https://github.com/zhgyuhuii/chayuan"
      target="_blank"
      rel="noopener noreferrer"
      title="GitHub"
      aria-label="在 GitHub 获取源码"
      @click.prevent="open('https://github.com/zhgyuhuii/chayuan')"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
        />
      </svg>
    </a>
    <a
      class="source-code-links-btn"
      href="https://gitee.com/cloudshd/chayuan-wps-releases"
      target="_blank"
      rel="noopener noreferrer"
      title="Gitee"
      aria-label="在 Gitee 获取源码"
      @click.prevent="open('https://gitee.com/cloudshd/chayuan-wps-releases')"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.531v1.418a.537.537 0 0 1-.592.53H9.777c-.982 0-1.778.796-1.778 1.778v5.334c0 .982.796 1.778 1.778 1.778h8.297a.537.537 0 0 1 .592.53v1.419a.537.537 0 0 1-.592.53H9.777A5.332 5.332 0 0 1 4.445 12.89V9.39a5.332 5.332 0 0 1 5.332-5.334h8.296z"
        />
      </svg>
    </a>
  </span>
</template>

<script>
export default {
  name: 'SourceCodeLinks',
  props: {
    /** 欢迎页等深色底用浅色图标 */
    light: { type: Boolean, default: false }
  },
  methods: {
    open(url) {
      const normalizedUrl = String(url || '').trim()
      if (!normalizedUrl) return
      const app = window.Application || window.opener?.Application || window.parent?.Application
      try {
        if (app?.OAAssist?.ShellExecute) {
          app.OAAssist.ShellExecute(normalizedUrl)
          return
        }
        if (app?.FollowHyperlink) {
          app.FollowHyperlink(normalizedUrl, '', true)
          return
        }
      } catch (_) { /* fall through */ }
      window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
    }
  }
}
</script>

<style scoped>
.source-code-links {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: inherit;
  vertical-align: middle;
}

.source-code-links-label {
  opacity: 0.9;
}

.source-code-links-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #24292f;
  background: rgba(15, 23, 42, 0.06);
  transition: background 0.15s ease, transform 0.15s ease, color 0.15s ease;
  text-decoration: none;
}

.source-code-links-btn:hover {
  background: rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.source-code-links--light {
  color: rgba(226, 232, 240, 0.86);
}

.source-code-links--light .source-code-links-btn {
  color: rgba(248, 250, 252, 0.95);
  background: rgba(248, 250, 252, 0.12);
}

.source-code-links--light .source-code-links-btn:hover {
  background: rgba(248, 250, 252, 0.22);
}
</style>
