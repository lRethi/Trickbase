import { setupSharedUI } from './shared.js'
import { loadGameData } from './data.js'

const CHANGELOG_ENTRIES = [
  { date: 'PLACEHOLDER', description: 'PLACEHOLDER' }
]

function escapeMarkup(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character])
}

function renderChangelog() {
  const list = document.querySelector('#home-changelog')
  if (!list) return
  list.innerHTML = CHANGELOG_ENTRIES.map(entry => `<li class="news-entry"><time>${escapeMarkup(entry.date)}</time><p>${escapeMarkup(entry.description)}</p></li>`).join('')
}

setupSharedUI()
renderChangelog()

try {
  const { cards } = await loadGameData()
  const count = document.querySelector('#collection-count')
  const total = document.querySelector('#collection-total')
  if (count && total) {
    count.textContent = cards.length.toLocaleString('pt-BR')
    total.hidden = false
  }
} catch (error) {
  const total = document.querySelector('#collection-total')
  if (total) total.hidden = true
}
