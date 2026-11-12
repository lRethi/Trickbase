import test from 'node:test'
import assert from 'node:assert/strict'
import { loadGameData } from '../js/data.js'

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
}

test('loadGameData agrega todas as coleções listadas no registro', async t => {
  const originalFetch = globalThis.fetch
  const payloads = new Map([
    ['data/collections/index.json', { collections: [
      { id: 'set-a', name: 'Set A', path: 'data/collections/set-a.json' },
      { id: 'set-b', name: 'Set B', path: 'data/collections/set-b.json' }
    ] }],
    ['data/collections/set-a.json', { id: 'set-a', name: 'Set A', cards: [{ id: 'set-a-001', name: 'Carta A', type: 'Criatura', colors: ['azul'], cost: 1 }] }],
    ['data/collections/set-b.json', { id: 'set-b', name: 'Set B', cards: [{ id: 'set-b-001', name: 'Carta B', type: 'Ação', colors: ['roxo'], cost: 2 }] }],
    ['data/collections/01_flowerpower/heroes.json', { id: 'heroes', cards: [{ 'forma-base': { id: 'hero-a', name: 'Herói A', colors: ['azul', 'verde'], 'ability-cost': 1, 'ability-text': 'PLACEHOLDER', image: '' } }] }],
    ['data/rules.json', { deckSize: { minimum: null, maximum: null } }]
  ])
  globalThis.fetch = async url => payloads.has(String(url)) ? jsonResponse(payloads.get(String(url))) : new Response('', { status: 404 })
  t.after(() => { globalThis.fetch = originalFetch })
  const data = await loadGameData()
  assert.equal(data.collections.length, 2)
  assert.deepEqual(data.cards.map(card => card.id), ['set-a-001', 'set-b-001'])
  assert.equal(data.catalog.getAll().length, 2)
})
