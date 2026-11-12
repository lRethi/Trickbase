import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { normalizeCollection } from "../src/domain/card-normalization.js"

const file = resolve("data/collections/01_flowerpower/cards.json")
const collection = JSON.parse(await readFile(file, "utf8"))
const cards = normalizeCollection(collection)
const ids = new Set()
const problems = []

for (const card of cards) {
  if (ids.has(card.id)) problems.push(`ID duplicado: ${card.id}`)
  ids.add(card.id)
  if (!card.name) problems.push(`${card.id}: nome vazio`)
  if (card.cost === null) problems.push(`${card.id}: custo pendente`)
  else if (!Number.isInteger(card.cost) || card.cost < 0) problems.push(`${card.id}: custo deve ser inteiro não negativo`)
  if (card.type === "Criatura" && (card.poder === null || card.vida === null)) problems.push(`${card.id}: criatura sem poder ou vida`)
  if (card.type !== "Criatura" && (card.poder !== null || card.vida !== null)) problems.push(`${card.id}: carta não-criatura possui poder ou vida`)
}

process.stdout.write(`Coleção: ${collection.name}\n`)
process.stdout.write(`Cartas: ${cards.length}\n`)
process.stdout.write(`Problemas encontrados: ${problems.length}\n`)
for (const problem of problems) process.stdout.write(`${problem}\n`)
if (problems.length > 0) process.exitCode = 1
