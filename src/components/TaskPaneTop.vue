<template>
  <div class="taskpane-top">
    <div class="header">
      <h2>顶部任务窗口</h2>
    </div>
    <div class="content">
      <p>这是顶部任务窗口界面</p>
      <div class="divItem">
        <button style="margin: 3px" @click="onDocNameClick()">获取文档名称</button>
      </div>
      <div class="divItem">
        文档文件名为：<span>{{ docName }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import taskPane from './js/taskpane.js'
export default {
  name: 'TaskPaneTop',
  data() {
    return {
      docName: ''
    }
  },
  methods: {
    onDocNameClick() {
      this.docName = taskPane.onbuttonclick('getDocName')
    }
  }
}
</script>

<style scoped>
.taskpane-top {
  font-size: 15px;
  min-height: 95%;
  padding: 10px;
}
.header {
  margin-bottom: 20px;
  border-bottom: 1px solid #ddd;
  padding-bottom: 10px;
}
.header h2 {
  margin: 0;
  font-size: 18px;
}
.content {
  margin-top: 10px;
}
.divItem {
  margin-left: 5px;
  margin-bottom: 18px;
  font-size: 15px;
  word-wrap: break-word;
}
</style>
