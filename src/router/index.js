import { createRouter, createWebHashHistory } from 'vue-router'
//import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history:  createWebHashHistory(''),
  routes: [
    {
      path: '/',
      name: '默认页',
      component: () => import('../components/Root.vue')
    },
    {
      path: '/dialog',
      name: '对话框',
      component: () => import('../components/Dialog.vue')
    },
    {
      path: '/taskpane',
      name: '任务窗格',
      component: () => import('../components/TaskPane.vue')
    },
    {
      path: '/taskpane-top',
      name: '顶部任务窗口',
      component: () => import('../components/TaskPaneTop.vue')
    },
    {
      path: '/taskpane-bottom',
      name: '底部任务窗口',
      component: () => import('../components/TaskPaneBottom.vue')
    },
    {
      path: '/taskpane-left',
      name: '左侧任务窗口',
      component: () => import('../components/TaskPaneLeft.vue')
    },
    {
      path: '/taskpane-right',
      name: '规则库',
      component: () => import('../components/TaskPaneRight.vue')
    },
    {
      path: '/popup',
      name: '任务清单',
      component: () => import('../components/Popup.vue')
    },
    {
      path: '/task-orchestration',
      name: '任务编排',
      component: () => import('../components/TaskOrchestrationDialog.vue')
    },
    {
      path: '/spell-check-dialog',
      name: '拼写与语法检查',
      component: () => import('../components/TaskProgressDialog.vue')
    },
    {
      path: '/task-progress-dialog',
      name: '任务进度',
      component: () => import('../components/TaskProgressDialog.vue')
    },
    {
      path: '/manual-col-width',
      name: '手动列宽',
      component: () => import('../components/ManualColWidth.vue')
    },
    {
      path: '/dialog-delete-text',
      name: '删除文字所在行/列',
      component: () => import('../components/DeleteTextDialog.vue')
    },
    {
      path: '/append-replace-text',
      name: '追加或替换文字',
      component: () => import('../components/AppendReplaceText.vue')
    },
    {
      path: '/dialog-first-col-style',
      name: '第一列指定样式',
      component: () => import('../components/FirstColStyleDialog.vue')
    },
    {
      path: '/table-caption',
      name: '添加或修改题注',
      component: () => import('../components/TableCaptionDialog.vue')
    },
    {
      path: '/dialog-uniform-image-format',
      name: '统一图像格式',
      component: () => import('../components/UniformImageFormatDialog.vue')
    },
    {
      path: '/document-declassify-dialog',
      name: '文档脱密',
      component: () => import('../components/DocumentDeclassifyDialog.vue')
    },
    {
      path: '/document-declassify-restore-dialog',
      name: '密码复原',
      component: () => import('../components/DocumentDeclassifyRestoreDialog.vue')
    },
    {
      path: '/template-create',
      name: '规则制作',
      component: () => import('../components/TemplateCreate.vue')
    },
    {
      path: '/template-form-dialog',
      name: '添加/修改表单项',
      component: () => import('../components/TemplateFormDialog.vue')
    },
    {
      path: '/template-field-extract-dialog',
      name: '智能提取',
      component: () => import('../components/TemplateFieldExtractDialog.vue')
    },
    {
      path: '/form-content-preview',
      name: '表单内容预览',
      component: () => import('../components/FormContentPreview.vue')
    },
    {
      path: '/form-audit-dialog',
      name: '文档审计',
      component: () => import('../components/FormAuditDialog.vue')
    },
    {
      path: '/form-edit-dialog',
      name: '表单编辑',
      component: () => import('../components/FormEditDialog.vue')
    },
    {
      path: '/template-export-dialog',
      name: '导出规则',
      component: () => import('../components/TemplateExportDialog.vue')
    },
    {
      path: '/template-import-dialog',
      name: '规则导入',
      component: () => import('../components/TemplateImportDialog.vue')
    },
    {
      path: '/document-template-import',
      name: '导入模板',
      component: () => import('../components/DocumentTemplateImport.vue')
    },
    {
      path: '/template-download-dialog',
      name: '下载模板',
      component: () => import('../components/TemplateDownloadDialog.vue')
    },
    {
      path: '/settings',
      name: '设置',
      component: () => import('../components/SettingsDialog.vue')
    },
    {
      path: '/style-statistics-dialog',
      name: '样式使用统计',
      component: () => import('../components/StyleStatisticsDialog.vue')
    },
    {
      path: '/unused-styles-cleaner-dialog',
      name: '未使用样式清理',
      component: () => import('../components/UnusedStylesCleanerDialog.vue')
    },
    {
      path: '/ai-assistant',
      name: 'AI 助手',
      component: () => import('../components/AIAssistantDialog.vue')
    },
    {
      path: '/about-chayuan',
      name: '关于察元',
      component: () => import('../components/AboutChayuanPage.vue')
    }
  ]
})

export default router
