/**
 * Resolve URLs for files in Vite `public/` (copied beside index.html in dist).
 * Leading "/" breaks WPS add-ins loaded from file:// or .../jsaddons/<name>/index.html.
 */
export function publicAssetUrl(relativePath) {
	const p = String(relativePath || '').replace(/^\/+/, '')
	if (!p) return ''
	const base = import.meta.env.BASE_URL || './'
	if (base.endsWith('/')) {
		return `${base}${p}`
	}
	return `${base}/${p}`
}
