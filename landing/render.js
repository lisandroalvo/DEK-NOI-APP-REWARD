// ABOUTME: Applies a locale's copy to the landing page DOM by element id.
// ABOUTME: Pure DOM writes so it can be unit-tested without a browser.
import { getContent } from './content.js'

export function applyContent(doc, lang) {
  const c = getContent(lang)
  const set = (id, text) => { const el = doc.getElementById(id); if (el) el.textContent = text }

  set('hero-eyebrow', c.heroEyebrow)
  set('tagline', c.tagline)
  set('hero-sub', c.heroSub)
  set('props-heading', c.propsHeading)
  set('open-app', c.openApp)
  set('location-heading', c.locationHeading)
  set('location-name', c.locationName)
  set('contact-heading', c.contactHeading)
  set('contact-line-label', c.contactLineLabel)
  set('footer-text', c.footer)

  const email = doc.getElementById('contact-email')
  if (email) { email.textContent = c.contactEmail; email.setAttribute('href', `mailto:${c.contactEmail}`) }
  const phone = doc.getElementById('contact-phone')
  if (phone) { phone.textContent = c.contactPhone }
  const map = doc.getElementById('location-map')
  if (map) map.setAttribute('href', c.locationMapUrl)

  const grid = doc.getElementById('value-props')
  if (grid) {
    grid.innerHTML = ''
    for (const p of c.valueProps) {
      const card = doc.createElement('div')
      card.className = 'prop'
      const badge = doc.createElement('span'); badge.className = 'prop-badge'; badge.textContent = p.emoji
      const h = doc.createElement('h3'); h.textContent = p.title
      const body = doc.createElement('p'); body.textContent = p.body
      card.appendChild(badge); card.appendChild(h); card.appendChild(body); grid.appendChild(card)
    }
  }

  doc.documentElement.lang = lang === 'en' ? 'en' : 'th'
  const toggle = doc.getElementById('lang-toggle')
  if (toggle) toggle.textContent = lang === 'en' ? 'TH' : 'EN'
}
