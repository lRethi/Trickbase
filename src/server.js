import { createServer } from "node:http"
import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"
import { CardCatalog, importDeck, exportDeck, validateDeck, analyzeDeck } from "./index.js"

const dataDirectory = resolve("data/collections")
const rulesPath = resolve("data/rules.json")
const collections = []

for (const filename of (await readdir(dataDirectory)).filter(name => name.endsWith(".json")).sort()) {
  collections.push(JSON.parse(await readFile(resolve(dataDirectory, filename), "utf8")))
}

const rules = JSON.parse(await readFile(rulesPath, "utf8"))
const catalog = new CardCatalog(collections)
const cards = new Map(catalog.getAll().map(card => [card.id, card]))

function send(response, status, body, contentType = "application/json; charset=utf-8") {
  response.writeHead(status, { "content-type": contentType })
  response.end(contentType.startsWith("application/json") ? JSON.stringify(body) : String(body))
}

async function readBody(request) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error("Corpo da requisição excede 1 MB.")
    chunks.push(buffer)
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"))
}

function parseFilters(url) {
  const getNumber = key => {
    const value = url.searchParams.get(key)
    if (value === null || value === "") return undefined
    const number = Number(value)
    return Number.isFinite(number) ? number : undefined
  }

  return {
    query: url.searchParams.get("q") ?? undefined,
    name: url.searchParams.get("name") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    subtype: url.searchParams.get("subtype") ?? undefined,
    rarity: url.searchParams.get("rarity") ?? undefined,
    collectionId: url.searchParams.get("collectionId") ?? undefined,
    costMin: getNumber("costMin"),
    costMax: getNumber("costMax"),
    colors: url.searchParams.get("colors")?.split(",").filter(Boolean),
    text: url.searchParams.get("text") ?? undefined,
    keyword: url.searchParams.get("keyword") ?? undefined
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://localhost")
    const method = request.method ?? "GET"

    if (method === "GET" && url.pathname === "/api/health") {
      send(response, 200, { status: "ok", collections: collections.length, cards: catalog.getAll().length })
      return
    }

    if (method === "GET" && url.pathname === "/api/collections") {
      send(response, 200, collections.map(({ id, name, version, cards: collectionCards }) => ({ id, name, version, cardCount: collectionCards.length })))
      return
    }

    if (method === "GET" && url.pathname === "/api/cards") {
      send(response, 200, catalog.search(parseFilters(url)))
      return
    }

    if (method === "GET" && url.pathname.startsWith("/api/cards/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/cards/".length))
      const card = catalog.getById(id)
      send(response, card ? 200 : 404, card ?? { error: "Carta não encontrada." })
      return
    }

    if (method === "POST" && url.pathname === "/api/decks/validate") {
      const deck = await readBody(request)
      send(response, 200, validateDeck(deck, cards, rules))
      return
    }

    if (method === "POST" && url.pathname === "/api/decks/analyze") {
      const deck = await readBody(request)
      if (!deck || !Array.isArray(deck.cards)) throw new Error("Estrutura de deck inválida.")
      send(response, 200, analyzeDeck(deck, cards))
      return
    }

    if (method === "POST" && url.pathname === "/api/decks/export") {
      const deck = await readBody(request)
      if (!deck || !Array.isArray(deck.cards) || typeof deck.name !== "string") throw new Error("Estrutura de deck inválida.")
      send(response, 200, exportDeck(deck), "text/plain; charset=utf-8")
      return
    }

    if (method === "POST" && url.pathname === "/api/decks/import") {
      const body = await readBody(request)
      if (typeof body?.content !== "string") {
        send(response, 400, { error: "O campo content deve ser uma string." })
        return
      }
      const deck = importDeck(body.content)
      send(response, 200, { deck, validation: validateDeck(deck, cards, rules) })
      return
    }

    send(response, 404, { error: "Endpoint não encontrado." })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno."
    send(response, 400, { error: message })
  }
})

const port = Number(process.env.PORT ?? 3001)
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`TCG API disponível em http://127.0.0.1:${port}\n`)
})
