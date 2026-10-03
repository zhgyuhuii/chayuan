/**
 * 文档绑定守卫（纯函数）：对话声明的文档与执行侧活动文档必须一致。
 * 设计总纲：每个对话只管一个文档，对当前文件负责——宁可不动手，不可写错档。
 * 空缺省（未声明/探测不到）放行——由 expectDocId 身份校验兜底。
 */
export function checkDocBinding(requestedDocId, activeDocId) {
  const req = String(requestedDocId || '').trim()
  const act = String(activeDocId || '').trim()
  if (!req || !act || req === act) return { ok: true }
  return {
    ok: false,
    message: `本对话属于「${req}」，但当前活动文档是「${act}」。为避免写错文件，本回合未执行。\n请切换回「${req}」后继续，或在当前文档中发送新指令开启它自己的对话。`
  }
}
