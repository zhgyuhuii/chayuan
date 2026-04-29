<!--
  CommandPaletteHost — 把 commandRegistry 的状态和事件接到 CommandPalette.vue 的"挂载壳"

  用法(典型):
    <!-- 在 App.vue / 任意主壳布局里:
    <template>
      <RouterView />
      <CommandPaletteHost v-if="!isDialog" />
    </template>

  特点:
    - 自动订阅 commandRegistry 的命令列表 + 显示状态
    - 自动响应 ⌘K(由 commandRegistry.installGlobalShortcut + CommandPalette.autoBind 双层兜底)
    - 命令执行时:把"最近使用"持久化由 CommandPalette 自身处理,本壳只做透传
    - props.exclude:可选,过滤掉某些 group(例如 dialog 页内不想显示"文档"类命令)
-->
<template>
  <CommandPalette
    :commands="filteredCommands"
    :show="show"
    :auto-bind="autoBind"
    :placeholder="placeholder"
    @update:show="onUpdateShow"
    @execute="onExecute"
    @close="onClose"
  />
</template>

<script>
import CommandPalette from './CommandPalette.vue'
import {
  subscribe, subscribeOpen,
  getAllCommands, isPaletteOpen,
  closePalette, openPalette
} from '../../utils/router/commandRegistry.js'

export default {
  name: 'CommandPaletteHost',
  components: { CommandPalette },
  props: {
    /** 排除某些分组(例如 ['文档']),数组里的 group 名不会出现在面板中 */
    exclude:     { type: Array,  default: () => [] },
    /** 仅保留某些分组(若给了,exclude 失效) */
    only:        { type: Array,  default: null },
    placeholder: { type: String, default: '搜索命令、助手或操作…' },
    /** CommandPalette 自带的 ⌘K 监听 — 默认开,这层壳跟随 */
    autoBind:    { type: Boolean, default: true }
  },
  data() {
    return {
      commands: getAllCommands(),
      show: isPaletteOpen()
    }
  },
  computed: {
    filteredCommands() {
      if (Array.isArray(this.only) && this.only.length) {
        const set = new Set(this.only)
        return this.commands.filter(c => set.has(c.group))
      }
      if (Array.isArray(this.exclude) && this.exclude.length) {
        const set = new Set(this.exclude)
        return this.commands.filter(c => !set.has(c.group))
      }
      return this.commands
    }
  },
  mounted() {
    this._unsubCmds = subscribe(list => { this.commands = list })
    this._unsubOpen = subscribeOpen(val => { this.show = val })
  },
  beforeUnmount() {
    this._unsubCmds?.()
    this._unsubOpen?.()
  },
  methods: {
    onUpdateShow(val) {
      // CommandPalette 自身的开关也应同步回注册表(单一真源)
      if (val) openPalette()
      else closePalette()
    },
    onClose() { closePalette() },
    onExecute(cmd) {
      // CommandPalette 已经调用了 cmd.handler;这里只保证执行后关闭
      closePalette()
      this.$emit('execute', cmd)
    }
  },
  emits: ['execute']
}
</script>
