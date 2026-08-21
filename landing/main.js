// ABOUTME: Browser entry for the landing page; wires the language toggle.
// ABOUTME: Renders Thai on load and flips between TH/EN on button click.
import { applyContent } from './render.js'

let lang = 'th'
applyContent(document, lang)

document.getElementById('lang-toggle')?.addEventListener('click', () => {
  lang = lang === 'th' ? 'en' : 'th'
  applyContent(document, lang)
})
