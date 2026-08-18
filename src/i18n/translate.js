// ABOUTME: Pure i18n resolver — dot-path lookup with en fallback and {var} interpolation.
// ABOUTME: No React/DOM so it is unit-testable in node; used by LanguageContext and hooks.
function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict)
}

export function translate(dict, fallbackDict, key, vars = {}) {
  let str = lookup(dict, key)
  if (typeof str !== 'string') str = lookup(fallbackDict, key)
  if (typeof str !== 'string') return key
  return str.replace(/\{(\w+)\}/g, (whole, token) =>
    token in vars ? String(vars[token]) : whole
  )
}

export function resolveInitialLang(stored) {
  return stored === 'en' || stored === 'th' ? stored : 'th'
}
