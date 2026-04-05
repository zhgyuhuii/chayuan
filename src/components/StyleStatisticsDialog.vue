<template>
  <div class="style-statistics-dialog">
    <div class="dialog-header-compact">
      <button class="btn-close" @click="onClose">×</button>
    </div>
    <div class="dialog-body">
      <div v-if="loading" class="loading">
        <div>正在统计样式...</div>
        <div v-if="progressText" class="progress-text">{{ progressText }}</div>
      </div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else class="style-table-container">
        <table class="style-table">
          <thead>
            <tr>
              <th class="col-style-name">样式名称</th>
              <th class="col-page">页码</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="styleItem in styleList" :key="styleItem.styleName">
              <tr
                v-for="(location, idx) in styleItem.locations"
                :key="`${styleItem.styleName}-${idx}`"
                class="table-row"
              >
                <td v-if="idx === 0" :rowspan="styleItem.locations.length" class="style-name-cell">
                  {{ styleItem.styleName }}
                </td>
                <td
                  class="page-cell"
                  :title="`双击跳转到第 ${location.page} 页`"
                  @dblclick="goToLocation(location)"
                >
                  第 {{ location.page }} 页
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <div v-if="styleList.length === 0" class="empty-hint">
          文档中未找到使用的样式
        </div>
      </div>
    </div>
    <div class="dialog-footer">
      <button class="btn btn-primary" @click="onClose">关闭</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StyleStatisticsDialog',
  data() {
    return {
      styleList: [],
      loading: true,
      error: null,
      progressText: ''
    }
  },
  mounted() {
    this.loadStyleStatistics()
  },
  methods: {
    async loadStyleStatistics() {
      try {
        this.loading = true
        this.error = null
        
        const app = window.Application
        if (!app) {
          this.error = 'Application 不可用'
          return
        }
        
        const doc = app.ActiveDocument
        if (!doc) {
          this.error = '当前没有打开任何文档'
          return
        }
        
        // 统计样式使用情况
        const styleMap = new Map()
        
        // 遍历所有段落（优化性能：避免频繁切换选择）
        const paragraphs = doc.Paragraphs
        if (!paragraphs || paragraphs.Count === 0) {
          this.styleList = []
          return
        }
        
        const totalCount = paragraphs.Count
        // Word/WPS 常量值：
        // wdActiveEndPageNumber = 7 (活动文档结束页码)
        // wdActiveEndAdjustedPageNumber = 8 (调整后的页码)
        // wdNumberOfPagesInDocument = 2 (文档总页数)
        const BATCH_SIZE = 100 // 每批处理100个段落，避免阻塞UI
        
        // 先更新文档的页码信息（确保页码计算正确）
        // 注意：Repaginate 可能很慢，对于大文档可以跳过
        try {
          if (typeof doc.Repaginate === 'function' && totalCount < 10000) {
            // 只有段落数少于10000时才重新分页，避免大文档性能问题
            doc.Repaginate()
            console.log('已重新分页文档')
          } else if (totalCount >= 10000) {
            console.log('文档段落数较多，跳过重新分页以提升性能')
          }
        } catch (repaginateError) {
          console.warn('重新分页失败（非关键）:', repaginateError)
        }
        
        // 保存当前选择（避免影响用户）
        let savedSelection = null
        let savedSelectionStart = null
        let savedSelectionEnd = null
        try {
          if (app.Selection && app.Selection.Range) {
            savedSelection = app.Selection.Range
            try {
              savedSelectionStart = app.Selection.Start
              savedSelectionEnd = app.Selection.End
            } catch (e) {}
          }
        } catch (e) {}
        
        // 分批处理，避免阻塞UI
        for (let batchStart = 1; batchStart <= totalCount; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalCount)
          
          // 使用 setTimeout 让出控制权，避免阻塞UI
          await new Promise(resolve => setTimeout(resolve, 0))
          
          for (let i = batchStart; i <= batchEnd; i++) {
            try {
              const para = paragraphs.Item(i)
              if (!para) continue
              
              // 获取段落样式（快速操作，不涉及选择）
              let styleName = null
              try {
                const style = para.Style
                if (style) {
                  styleName = style.NameLocal || style.Name || (typeof style === 'string' ? style : null)
                }
              } catch (e) {
                // 忽略错误，继续处理下一个
                continue
              }
              
              if (!styleName) continue
              
              // 获取段落所在页码
              // 方法：先选中段落起始位置，然后通过Selection获取页码（最准确）
              let pageNumber = 1
              try {
                const range = para.Range
                if (!range) continue
                
                // 方法1：通过选中段落起始位置来获取页码（最准确，但可能影响性能）
                // 只在每批的第一个段落或每100个段落执行一次，减少性能影响
                if (i === batchStart || i % 100 === 0) {
                  try {
                    // 创建范围副本并收缩到起始位置
                    if (typeof range.Duplicate === 'function') {
                      const startRange = range.Duplicate()
                      if (startRange && typeof startRange.Collapse === 'function') {
                        startRange.Collapse(1) // wdCollapseStart = 1
                        
                        // 选中这个位置
                        startRange.Select()
                        
                        // 通过Selection获取页码（更准确）
                        if (app.Selection && typeof app.Selection.Information === 'function') {
                          // 尝试多个常量值
                          const pageConstants = [3, 7, 8, 1]
                          for (const pageConst of pageConstants) {
                            try {
                              const pageInfo = app.Selection.Information(pageConst)
                              if (pageInfo !== undefined && pageInfo !== null && pageInfo !== '') {
                                const parsed = parseInt(pageInfo, 10)
                                if (!isNaN(parsed) && parsed > 0) {
                                  pageNumber = parsed
                                  break
                                }
                              }
                            } catch (constError) {
                              continue
                            }
                          }
                        }
                      }
                    }
                  } catch (selectError) {
                    // 如果选中失败，使用Range.Information方法
                    // 继续到方法2
                  }
                }
                
                // 方法2：如果方法1未执行或失败，使用Range.Information（性能更好）
                if (pageNumber === 1 || (i !== batchStart && i % 100 !== 0)) {
                  try {
                    // 使用 Range.Duplicate 创建副本，收缩到起始位置后获取页码
                    if (typeof range.Duplicate === 'function' && typeof range.Information === 'function') {
                      const startRange = range.Duplicate()
                      if (startRange) {
                        if (typeof startRange.Collapse === 'function') {
                          startRange.Collapse(1) // wdCollapseStart = 1
                        }
                        
                        // 尝试多个常量值来获取页码
                        const pageConstants = [3, 7, 8, 1]
                        for (const pageConst of pageConstants) {
                          try {
                            const pageInfo = startRange.Information(pageConst)
                            if (pageInfo !== undefined && pageInfo !== null && pageInfo !== '') {
                              const parsed = parseInt(pageInfo, 10)
                              if (!isNaN(parsed) && parsed > 0) {
                                pageNumber = parsed
                                break
                              }
                            }
                          } catch (constError) {
                            continue
                          }
                        }
                      }
                    } else if (typeof range.Information === 'function') {
                      // 如果没有 Duplicate，直接使用原范围
                      const pageConstants = [3, 7, 8, 1]
                      for (const pageConst of pageConstants) {
                        try {
                          const pageInfo = range.Information(pageConst)
                          if (pageInfo !== undefined && pageInfo !== null && pageInfo !== '') {
                            const parsed = parseInt(pageInfo, 10)
                            if (!isNaN(parsed) && parsed > 0) {
                              pageNumber = parsed
                              break
                            }
                          }
                        } catch (constError) {
                          continue
                        }
                      }
                    }
                  } catch (infoError) {
                    // 忽略错误
                  }
                }
                
                // 调试：记录前几个段落的页码信息（仅用于调试）
                if (i <= 10) {
                  console.log(`段落 ${i} (样式: ${styleName}): 页码 = ${pageNumber}`)
                }
              } catch (e) {
                // 忽略错误，使用默认页码1
                if (i <= 10) {
                  console.warn(`段落 ${i} 获取页码失败:`, e)
                }
              }
              
              // 添加到统计（不保存 range 对象，只保存索引，避免内存问题）
              if (!styleMap.has(styleName)) {
                styleMap.set(styleName, new Map()) // 使用 Map 来去重页码
              }
              
              const styleLocations = styleMap.get(styleName)
              // 如果该页码还没有记录，才添加（去重：同一页只统计一次）
              if (!styleLocations.has(pageNumber)) {
                styleLocations.set(pageNumber, {
                  page: pageNumber,
                  paragraphIndex: i // 保存第一个出现的段落索引，用于跳转
                })
              }
            } catch (e) {
              // 忽略单个段落的错误，继续处理
              continue
            }
          }
          
          // 更新进度提示
          if (batchEnd % 1000 === 0 || batchEnd === totalCount) {
            const percent = Math.round((batchEnd / totalCount) * 100)
            this.progressText = `已处理 ${batchEnd}/${totalCount} 个段落 (${percent}%)`
            console.log(`已处理 ${batchEnd}/${totalCount} 个段落 (${percent}%)`)
          }
        }
        
        // 恢复原选择
        if (savedSelection) {
          try {
            savedSelection.Select()
          } catch (e) {
            // 如果Select失败，尝试通过Start和End恢复
            try {
              if (savedSelectionStart !== null && savedSelectionEnd !== null && app.Selection) {
                app.Selection.SetRange(savedSelectionStart, savedSelectionEnd)
              }
            } catch (e2) {
              // 恢复失败不影响结果
            }
          }
        }
        
        // 转换为列表格式并排序
        // styleMap 的值现在是 Map<pageNumber, location>，需要转换为数组
        this.styleList = Array.from(styleMap.entries())
          .map(([styleName, pageMap]) => {
            // 将 Map 转换为数组，并按页码排序
            const locations = Array.from(pageMap.values()).sort((a, b) => {
              // 按页码排序
              return a.page - b.page
            })
            return {
              styleName,
              locations
            }
          })
          .sort((a, b) => a.styleName.localeCompare(b.styleName))
        
        console.log(`样式统计完成: 共 ${this.styleList.length} 种样式，处理了 ${totalCount} 个段落`)
      } catch (e) {
        console.error('加载样式统计失败:', e)
        this.error = '加载样式统计失败：' + (e?.message || '未知错误')
      } finally {
        this.loading = false
        this.progressText = ''
      }
    },
    goToLocation(location) {
      try {
        const app = window.Application
        if (!app) {
          alert('Application 不可用')
          return
        }
        
        const doc = app.ActiveDocument
        if (!doc) {
          alert('当前没有打开任何文档')
          return
        }
        
        // 跳转到指定位置并选中内容
        try {
          // 通过段落索引跳转并选中（推荐方法，性能好，不依赖保存的 range 对象）
          if (location.paragraphIndex !== undefined) {
            try {
              const paragraphs = doc.Paragraphs
              if (paragraphs && paragraphs.Count >= location.paragraphIndex) {
                const para = paragraphs.Item(location.paragraphIndex)
                if (para && para.Range) {
                  const range = para.Range
                  range.Select()
                  
                  // 确保选中内容可见
                  if (typeof app.Selection?.ScrollIntoView === 'function') {
                    app.Selection.ScrollIntoView()
                  }
                  
                  // 扩展选择到整个段落（可选）
                  try {
                    if (typeof app.Selection?.Expand === 'function') {
                      // wdParagraph = 5，扩展到段落
                      app.Selection.Expand(5)
                    }
                  } catch (expandError) {
                    // 扩展失败不影响选中
                  }
                  
                  console.log(`已跳转到第 ${location.page} 页并选中段落（使用段落索引）`)
                  return
                }
              }
            } catch (paraError) {
              console.warn('通过段落索引跳转失败，尝试页码跳转:', paraError)
            }
          }
          
          // 备用方法2：通过页码跳转（无法精确选中，只能跳转到页面）
          const wdGoToPage = 1
          if (typeof app.Selection?.GoTo === 'function') {
            app.Selection.GoTo(wdGoToPage, 0, 0, String(location.page))
            // 确保页面可见
            if (typeof app.Selection?.ScrollIntoView === 'function') {
              app.Selection.ScrollIntoView()
            }
            console.log(`已跳转到第 ${location.page} 页（使用页码，无法精确选中）`)
          } else {
            alert('当前环境不支持跳转功能')
          }
        } catch (e) {
          console.error('跳转失败:', e)
          alert('跳转失败：' + (e?.message || '未知错误'))
        }
      } catch (e) {
        console.error('跳转位置失败:', e)
        alert('跳转失败：' + (e?.message || '未知错误'))
      }
    },
    onClose() {
      try {
        if (window.close) window.close()
      } catch (e) {}
    }
  }
}
</script>

<style scoped>
.style-statistics-dialog {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 500px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

.dialog-header-compact {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 4px 8px;
  border-bottom: 1px solid #e0e0e0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close:hover {
  color: #000;
}

.dialog-body {
  flex: 1;
  padding: 8px 12px;
  overflow-y: auto;
}

.loading,
.error {
  padding: 20px;
  text-align: center;
  font-size: 14px;
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-text {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.error {
  color: #c33;
}

.style-table-container {
  overflow-x: auto;
}

.style-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.style-table thead {
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 10;
}

.style-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #333;
  border-bottom: 2px solid #e0e0e0;
}

.col-style-name {
  width: 40%;
  min-width: 150px;
}

.col-page {
  width: 60%;
}

.style-table tbody tr {
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.style-table tbody tr:hover {
  background-color: #f9f9f9;
}

.style-name-cell {
  padding: 10px 12px;
  font-weight: 500;
  color: #333;
  vertical-align: top;
  border-right: 1px solid #f0f0f0;
}

.page-cell {
  padding: 10px 12px;
  color: #1890ff;
  cursor: pointer;
  font-weight: 500;
  vertical-align: top;
}

.page-cell:hover {
  text-decoration: underline;
  color: #40a9ff;
}

.empty-hint {
  padding: 24px 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 6px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background-color: #1890ff;
  color: #fff;
  border-color: #1890ff;
}

.btn-primary:hover {
  background-color: #40a9ff;
  border-color: #40a9ff;
}
</style>
