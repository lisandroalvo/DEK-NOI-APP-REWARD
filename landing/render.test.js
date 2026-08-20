// ABOUTME: Tests that applyContent writes the right locale into the DOM.
// ABOUTME: Uses a minimal happy-dom/jsdom document built inline.
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { applyContent } from './render.js'
import { CONTENT } from './content.js'

function makeDoc() {
  document.documentElement.lang = 'th'
  document.body.innerHTML = `
    <button id="lang-toggle">EN</button>
    <h1 id="tagline"></h1>
    <div id="value-props"></div>
    <a id="open-app"></a>
    <h2 id="location-heading"></h2>
    <span id="location-name"></span>
    <a id="location-map"></a>
    <h2 id="contact-heading"></h2>
    <a id="contact-email"></a>
    <a id="contact-phone"></a>
    <span id="footer-text"></span>`
  return document
}

describe('applyContent', () => {
  beforeEach(() => { makeDoc() })

  it('renders English copy and sets EN state', () => {
    applyContent(document, 'en')
    expect(document.getElementById('tagline').textContent).toBe(CONTENT.en.tagline)
    expect(document.getElementById('open-app').textContent).toBe(CONTENT.en.openApp)
    expect(document.getElementById('value-props').children.length).toBe(3)
    expect(document.documentElement.lang).toBe('en')
    expect(document.getElementById('lang-toggle').textContent).toBe('TH')
  })

  it('renders Thai copy and sets TH state', () => {
    applyContent(document, 'th')
    expect(document.getElementById('tagline').textContent).toBe(CONTENT.th.tagline)
    expect(document.documentElement.lang).toBe('th')
    expect(document.getElementById('lang-toggle').textContent).toBe('EN')
  })
})
