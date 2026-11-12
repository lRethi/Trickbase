import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { CardCatalog } from '../js/core/card-catalog.js'
import { canonicalColor, canonicalColors, matchesColorFilter } from '../js/core/colors.js'
import { HeroCatalog, normalizeHeroCollection } from '../js/core/heroes.js'
import { createDeck, addCard, normalizeDeck, countZone } from '../js/core/deck-builder.js'
import { effectiveCardCost, analyzeDeck } from '../js/core/deck-analyzer.js'
import { exportDeck, importDeck } from '../js/core/deck-io.js'
import { validateDeck } from '../js/core/deck-validation.js'
import { matchesSearch } from '../js/data.js'

const heroPayload = JSON.parse(await readFile(new URL('../data/collections/01_flowerpower/heroes.json', import.meta.url), 'utf8'))
const heroes = normalizeHeroCollection(heroPayload)
const heroMap = new Map(heroes.map(hero => [hero.id, hero]))
const cards = [
  { id: 'mente-card', name: 'Carta Mente', type: 'Criatura', cost: 2, colors: ['azul'] },
  { id: 'furia-card', name: 'Carta Fúria', type: 'Ação', cost: 3, colors: ['vermelho'] },
  { id: 'multi-card', name: 'Carta Mista', type: 'Criatura', cost: 1, colors: ['azul', 'verde'] },
  { id: 'colorless-card', name: 'Carta sem cor', type: 'Ação', cost: 0, colors: ['incolor'] },
  { id: 'token-card', name: 'Ficha', type: 'Ficha', cost: 0, colors: [] }
]
const cardMap = new Map(cards.map(card => [card.id, card]))
const rules = { deckSize: { minimum: 2, maximum: 3, heroCountsTowardSize: false }, maximumCopiesPerCard: 2, heroRequired: true }

test('database contém 15 Heróis únicos e Aaron possui duas formas', () => {
  assert.equal(heroes.length, 15)
  const aaron = heroMap.get('aaron')
  assert.equal(aaron.forms.length, 2)
  assert.equal(aaron.forms[0].id, 'forma-base')
  assert.equal(aaron.forms[1].id, 'forma-alternativa')
})

test('todos os Heróis possuem exatamente duas cores canônicas', () => {
  for (const hero of heroes) assert.equal(hero.colors.length, 2)
  assert.deepEqual(heroMap.get('aaron').colors, ['calma', 'furia'])
})

test('nomes tradicionais e canônicos resolvem para a mesma cor', () => {
  assert.equal(canonicalColor('Azul'), 'mente')
  assert.equal(canonicalColor('Mente'), 'mente')
  assert.equal(canonicalColor('Vermelho'), 'furia')
  assert.equal(canonicalColor('Fúria'), 'furia')
  assert.deepEqual(canonicalColors(['azul', 'Mente', 'vermelho']), ['mente', 'furia'])
  assert.equal(matchesColorFilter(['azul'], 'Mente'), true)
  assert.equal(matchesColorFilter(['vermelho'], 'Fúria'), true)
  assert.equal(matchesColorFilter(['incolor'], 'incolor'), true)
})

test('CardCatalog pesquisa cartas e Heróis pelos nomes de cor tradicionais ou canônicos', () => {
  const catalog = new CardCatalog([{ id: 'sample', cards }], [heroPayload])
  assert.equal(catalog.search({ query: 'Mente' }).some(card => card.id === 'mente-card'), true)
  assert.equal(catalog.search({ query: 'Azul' }).some(card => card.id === 'mente-card'), true)
  assert.equal(catalog.search({ colors: ['azul'] }).some(card => card.id === 'mente-card'), true)
  assert.equal(catalog.search({ colors: ['incolor'] }).some(card => card.id === 'colorless-card'), true)
  assert.equal(matchesSearch(cards[0], 'Mente'), true)
  assert.equal(matchesSearch(cards[0], 'Azul'), true)
  assert.equal(matchesSearch(cards[0], 'cor:azul'), true)
  assert.equal(matchesSearch(cards[3], 'cor:incolor'), true)
  assert.equal(catalog.searchHeroes({ query: 'Azul' }).some(hero => hero.id === 'reginauld'), true)
  assert.equal(catalog.searchHeroes({ query: 'Mente' }).some(hero => hero.id === 'reginauld'), true)
  const heroCatalog = new HeroCatalog([heroPayload])
  assert.equal(heroCatalog.search({ query: 'Azul' }).some(hero => hero.id === 'reginauld'), true)
  assert.equal(heroCatalog.search({ query: 'Mente' }).some(hero => hero.id === 'reginauld'), true)
})

test('cartas fora da identidade recebem +1, cartas internas e sem cor não recebem', () => {
  const hero = heroMap.get('reginauld')
  assert.equal(effectiveCardCost(cardMap.get('mente-card'), hero), 2)
  assert.equal(effectiveCardCost(cardMap.get('multi-card'), hero), 1)
  assert.equal(effectiveCardCost(cardMap.get('furia-card'), hero), 4)
  assert.equal(effectiveCardCost(cardMap.get('colorless-card'), hero), 0)
})

test('tokens são enviados automaticamente ao Sideboard', () => {
  let deck = createDeck()
  deck = addCard(deck, cardMap.get('token-card'), 1, { cards: cardMap, zone: 'mainboard' })
  assert.equal(deck.mainboard['token-card'], undefined)
  assert.equal(deck.sideboard['token-card'], 1)
  deck = normalizeDeck({ ...deck, mainboard: { 'token-card': 1 } }, cardMap)
  assert.equal(deck.mainboard['token-card'], undefined)
  assert.equal(deck.sideboard['token-card'], 2)
})

test('Sideboard não entra na contagem do Mainboard ou no limite de tamanho', () => {
  let deck = createDeck()
  deck = { ...deck, heroId: 'reginauld', mainboard: { 'mente-card': 1, 'furia-card': 1 }, sideboard: { 'colorless-card': 2, 'token-card': 1 } }
  const result = validateDeck(deck, cardMap, rules, heroMap)
  assert.equal(result.mainboardCount, 2)
  assert.equal(result.sideboardCount, 3)
  assert.equal(result.valid, true)
  assert.equal(countZone(deck, 'mainboard'), 2)
  assert.equal(countZone(deck, 'sideboard'), 3)
})

test('limite de cópias considera Mainboard e Sideboard em conjunto', () => {
  const deck = { ...createDeck(), heroId: 'reginauld', mainboard: { 'mente-card': 2 }, sideboard: { 'mente-card': 1 } }
  const result = validateDeck(deck, cardMap, rules, heroMap)
  assert.equal(result.errors.some(error => error.code === 'COPY_LIMIT_EXCEEDED'), true)
})

test('análise usa custo efetivo e separa Sideboard', () => {
  const deck = { ...createDeck(), heroId: 'reginauld', mainboard: { 'mente-card': 1, 'furia-card': 1 }, sideboard: { 'token-card': 1 } }
  const result = analyzeDeck(deck, cardMap, heroMap)
  assert.equal(result.totalCards, 2)
  assert.equal(result.sideboardCards, 1)
  assert.equal(result.offIdentityCards, 1)
  assert.equal(result.manaCurve['2'], 1)
  assert.equal(result.manaCurve['4'], 1)
  assert.equal(result.tokens, 0)
  assert.equal(result.sideboardAnalysis.tokens, 1)
  assert.equal(result.colorCounts.mente, 1)
  assert.equal(result.colorCounts.furia, 1)
  assert.equal(result.sideboardColorCounts.mente, 0)
})

test('exportação e importação preservam Herói, forma, Mainboard e Sideboard', () => {
  const deck = { ...createDeck('Teste de deck'), heroId: 'aaron', heroFormId: 'forma-alternativa', mainboard: { 'mente-card': 2 }, sideboard: { 'token-card': 1 } }
  const content = exportDeck(deck, cardMap)
  const imported = importDeck(content, { cards: cardMap, heroes: heroMap })
  assert.equal(imported.name, deck.name)
  assert.equal(imported.heroId, 'aaron')
  assert.equal(imported.heroFormId, 'forma-alternativa')
  assert.deepEqual(imported.mainboard, deck.mainboard)
  assert.deepEqual(imported.sideboard, deck.sideboard)
})

test('importação do formato antigo continua aceita e move tokens para Sideboard', () => {
  const imported = importDeck('TCG-DECK/1\nname=Antigo\nhero=reginauld\n\n[cards]\n1 mente-card\n1 token-card\n', { cards: cardMap, heroes: heroMap })
  assert.equal(imported.mainboard['mente-card'], 1)
  assert.equal(imported.mainboard['token-card'], undefined)
  assert.equal(imported.sideboard['token-card'], 1)
  assert.equal(imported.heroId, 'reginauld')
})

test('validador rejeita Mainboard vazio mesmo que o Sideboard tenha cartas', () => {
  const deck = { ...createDeck(), heroId: 'reginauld', mainboard: {}, sideboard: { 'token-card': 1 } }
  const result = validateDeck(deck, cardMap, rules, heroMap)
  assert.equal(result.errors.some(error => error.code === 'DECK_EMPTY'), true)
  assert.equal(result.mainboardCount, 0)
  assert.equal(result.sideboardCount, 1)
})

test('validador identifica forma de Herói inválida', () => {
  const deck = { ...createDeck(), heroId: 'aaron', heroFormId: 'forma-que-nao-existe', mainboard: { 'mente-card': 1 } }
  const result = validateDeck(deck, cardMap, rules, heroMap)
  assert.equal(result.errors.some(error => error.code === 'INVALID_HERO_FORM'), true)
})

test('validador rejeita Herói inexistente e alerta para Ficha legada no Mainboard', () => {
  const deck = { ...createDeck(), heroId: 'ghost', mainboard: { 'token-card': 1 } }
  const result = validateDeck(deck, cardMap, rules, heroMap)
  assert.equal(result.errors.some(error => error.code === 'UNKNOWN_HERO'), true)
  assert.equal(result.warnings.some(warning => warning.code === 'TOKEN_MOVED_TO_SIDEBOARD'), true)
})
