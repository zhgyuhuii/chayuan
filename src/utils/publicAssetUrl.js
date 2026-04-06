/**
 * WPS 加载项 public/ 静态资源 URL（与 dist 根目录下 index.html 同级的 images/ 等）。
 *
 * 策略（覆盖 wpsjs debug / 离线安装 / 在线子路径部署）：
 * 1. 优先用 PluginStorage「AddinBaseUrl」+ location 推导的插件根（Ribbon getImage 回调里 document.baseURI 往往不是加载项目录，不能放在最前）。
 * 2. 再用 document.baseURI + URL(relative, base)（任务窗格、对话框等正常 WebView）。
 * 3. 再否则当前页 location。
 * 4. 最后 import.meta.env.BASE_URL。
 */

function stripHash(href) {
	return String(href || '').split('#')[0]
}

function getStoredAddonBaseClean() {
	try {
		let s = window.Application?.PluginStorage?.getItem('AddinBaseUrl') || ''
		s = stripHash(s).replace(/\/?index\.html$/i, '').trim().replace(/\/+$/, '')
		return s
	} catch {
		return ''
	}
}

/**
 * 将当前页面对应的加载项目录写入 PluginStorage，供 Ribbon getImage 早于 Vue mount 使用。
 * 与 App.vue 中逻辑一致，集中在一处避免遗漏。
 */
export function syncAddonBaseUrlToPluginStorage() {
	try {
		if (typeof window === 'undefined' || !window.Application?.PluginStorage) return
		const href = (window.location.href || '').split('#')[0]
		let base = ''
		if (window.location.protocol === 'file:') {
			base = href.replace(/\/?index\.html$/i, '')
		} else {
			base =
				`${window.location.origin}${window.location.pathname || ''}`.replace(/\/?index\.html$/i, '') || ''
		}
		base = String(base || '').replace(/\/+$/, '')
		if (base) {
			base = `${base}/`
		}
		window.Application.PluginStorage.setItem('AddinBaseUrl', base || href)
	} catch {
		/* ignore */
	}
}

/**
 * 供 ribbon 等在无可靠 document 时使用：加载项目录，带尾部 /。
 */
export function getAddonRootHrefForRibbon() {
	if (typeof window === 'undefined') return ''
	const stored = getStoredAddonBaseClean()
	if (stored) {
		if (stored.startsWith('file:')) return stored.endsWith('/') ? stored : `${stored}/`
		if (/^https?:\/\//i.test(stored)) return stored.endsWith('/') ? stored : `${stored}/`
	}
	const href = stripHash(window.location?.href || '')
	const proto = window.location?.protocol || ''
	if (!href) return ''
	let base = ''
	if (proto === 'file:') {
		base = href.replace(/\/?index\.html$/i, '').replace(/\/+$/, '')
	} else {
		base = `${window.location.origin}${window.location.pathname || ''}`
			.replace(/\/?index\.html$/i, '')
			.replace(/\/+$/, '')
	}
	if (!base) return ''
	if (base.startsWith('file:')) return `${base}/`
	if (/^https?:\/\//i.test(base)) return `${base}/`
	return ''
}

/**
 * public 目录下资源的最终绝对或相对 URL。
 */
export function publicAssetUrl(relativePath) {
	const p = String(relativePath || '').replace(/^\/+/, '')
	if (!p) return ''

	if (/^(https?:\/\/|data:|file:)/i.test(p)) {
		return p
	}

	// 1) 插件根（PluginStorage + location）：Ribbon getImage 等场景 document.baseURI 不可靠，必须优先
	const rootFromAddon = getAddonRootHrefForRibbon()
	if (rootFromAddon) {
		try {
			return new URL(p, rootFromAddon).href
		} catch {
			return `${rootFromAddon.replace(/\/+$/, '/')}${p}`
		}
	}

	// 2) 与当前文档一致（对话框、任务窗格、ShowDialog 内 WebView）
	if (typeof document !== 'undefined' && document.baseURI) {
		try {
			return new URL(p, document.baseURI).href
		} catch {
			/* fall through */
		}
	}

	// 3) location
	if (typeof window !== 'undefined' && window.location?.href) {
		try {
			return new URL(p, stripHash(window.location.href)).href
		} catch {
			/* fall through */
		}
	}

	const fb = (import.meta.env.BASE_URL || './').replace(/\/?$/, '/')
	try {
		if (fb.startsWith('http://') || fb.startsWith('https://') || fb.startsWith('file:')) {
			return new URL(p, fb).href
		}
	} catch {
		/* ignore */
	}
	return `${fb}${p}`
}

if (typeof window !== 'undefined') {
	syncAddonBaseUrlToPluginStorage()
}

/** @deprecated 保留兼容；逻辑已并入 publicAssetUrl */
export function getAddonPublicDirectoryBase() {
	if (typeof document !== 'undefined' && document.baseURI) {
		try {
			const u = new URL('.', document.baseURI)
			return u.href
		} catch {
			/* ignore */
		}
	}
	const r = getAddonRootHrefForRibbon()
	return r || `${(import.meta.env.BASE_URL || './').replace(/\/?$/, '/')}`
}
