<template>
  <PurchaseGuideDialog
    :visible="true"
    :reason="reason"
    @close="onClose"
    @activated="onActivated"
  />
</template>

<script>
import PurchaseGuideDialog from './PurchaseGuideDialog.vue'

export default {
  name: 'PurchaseGuideDialogPage',
  components: { PurchaseGuideDialog },
  computed: {
    reason() {
      return String(this.$route?.query?.reason || 'assistant_quota')
    }
  },
  methods: {
    onActivated() {
      // 激活成功后 PurchaseGuideDialog 内部会再 emit close，由 onClose 关窗
    },
    onClose() {
      try { if (window.close) window.close() } catch (e) { void e }
    }
  }
}
</script>
