# Trick — frontend e mecânicas centrais

Projeto estático em HTML, CSS e JavaScript ES Modules. Não utiliza framework, bundler ou dependências de terceiros para executar o site.

## Instalação no projeto existente

Extraia o pacote e copie o conteúdo de `trick-complete/` para a raiz de `~/trickbase/`, mesclando as pastas e substituindo os arquivos de frontend e os módulos `js/`.

Preserve os dados e recursos que já existem no seu projeto:

- `data/collections/flowerpower.json`
- `assets/images/icon.webp`
- `assets/cards/01_flowerpower/`
- `assets/heroes/01_flowerpower/`

O pacote inclui `data/collections/01_flowerpower/heroes.json`, `data/rules.json` e `assets/images/card-back.webp`. As imagens dos Heróis continuam usando os caminhos declarados no JSON, dentro de `assets/heroes/01_flowerpower/`. Se uma imagem ainda não estiver nesse caminho, a interface usa o verso de carta como fallback.

Se o seu `data/rules.json` já tiver limites oficiais de deck configurados, preserve os valores de `deckSize.minimum` e `deckSize.maximum` ao mesclar o arquivo incluído.

## Executar

Na raiz do projeto:

```bash
python -m http.server 8000
```

Acesse `http://127.0.0.1:8000`. Não abra as páginas diretamente com `file://`, pois o carregamento dos arquivos JSON usa `fetch`.

Nenhum `npm install` é necessário. Para executar os testes do núcleo, com Node.js disponível:

```bash
node --test tests/*.test.js
```

## Estrutura

```text
trickbase/
├── index.html
├── glossario.html
├── deckbuilder.html
├── tiermaker.html
├── playground.html
├── assets/
│   └── images/card-back.webp
├── css/
│   ├── styles.css
│   └── tools.css
├── data/
│   ├── rules.json
│   └── collections/
│       ├── index.json
│       └── 01_flowerpower/heroes.json
├── js/
│   ├── data.js
│   ├── tiermaker.js
│   ├── playground.js
│   ├── shared.js
│   ├── glossary.js
│   ├── deckbuilder.js
│   └── core/
│       ├── colors.js
│       ├── card-catalog.js
│       ├── heroes.js
│       ├── deck-builder.js
│       ├── deck-analyzer.js
│       ├── deck-io.js
│       └── deck-validation.js
└── tests/
    ├── core.test.js
    └── collections-registry.test.js
```

## Heróis

O database fornecido contém 15 Heróis. Aaron é um único Herói com duas formas (`forma-base` e `forma-alternativa`); a forma escolhida fica salva no deck. O banco de Heróis é carregado separadamente do catálogo de cartas e não mistura Heróis com cartas comuns.

Cada Herói precisa ter exatamente duas cores principais distintas. O Deckbuilder permite pesquisar por nome, habilidade, identificador e cor, selecionar um Herói e visualizar sua imagem, habilidade, custo de habilidade e Color Pie. A forma do Aaron pode ser alternada tanto na visualização quanto depois da seleção.

A identidade usa os nomes canônicos:

| Nome canônico | Nome tradicional aceito na busca |
|---|---|
| Mente | Azul |
| Calma | Verde |
| Ordem | Amarelo |
| Corpo | Laranja |
| Fúria | Vermelho |
| Caos | Roxo |

A interface exibe somente os nomes canônicos. A busca aceita ambos os nomes. `Incolor` é tratado como ausência de cores e permanece disponível como filtro de cartas, identificado na interface como `Sem cor`.

## Acréscimo de custo por identidade

A identidade do Herói é formada pelas duas cores do seu registro. Uma carta recebe +1 no custo efetivo quando possui pelo menos uma cor que não pertence à identidade selecionada. Cartas sem cor não recebem acréscimo.

O custo efetivo é calculado em tempo de execução, mostrado nos resultados e na lista do deck e utilizado pela curva de custos e pela análise. O custo impresso no database não é alterado. Na exportação é gravado o ID do Herói e sua forma; na importação, o custo efetivo é recalculado a partir desses dados.

## Mainboard e Sideboard

O deck possui duas zonas:

- Mainboard: conta para os limites mínimo e máximo configurados em `data/rules.json`.
- Sideboard: possui contagem própria e não entra no limite de tamanho do deck.

Fichas são encaminhadas automaticamente para o Sideboard ao serem adicionadas, carregadas de um rascunho antigo ou importadas. Não é permitido movê-las para o Mainboard. O limite de cópias por carta é contado em conjunto entre Mainboard e Sideboard.

O analisador mostra a curva de custos e a distribuição de cores do Mainboard. As informações do Sideboard são contabilizadas separadamente. O custo efetivo das cartas do Sideboard também pode ser consultado na lista.

## Formato de deck

A exportação usa `TRICK-DECK/2`:

```text
TRICK-DECK/2
name=Meu%20Deck
hero=aaron
hero-form=forma-alternativa

[mainboard]
2 flowerpower-001

[sideboard]
1 flowerpower-231
```

A importação também aceita `TRICK-DECK/1` e `TCG-DECK/1`. A antiga seção `[cards]` é lida como Mainboard; fichas encontradas nela são movidas para o Sideboard.

## Armazenamento

O rascunho e os decks salvos ficam no `localStorage` do navegador. A chave nova do rascunho é `trick-current-deck-v2`; decks antigos são lidos e convertidos para o novo formato. Não há sincronização entre dispositivos, contas ou armazenamento remoto.

## Regras ainda não definidas

`data/rules.json` mantém os limites mínimo e máximo como `null` até que os valores oficiais sejam informados. O Sideboard não conta no tamanho do deck. A regra de quantidade máxima de cópias permanece em 2 no arquivo incluído e é aplicada ao total entre as duas zonas.


## Refinamentos de interface

A identidade visual usa os seis acentos cromáticos de Trick em detalhes de navegação, painéis, botões, distribuição de cores e elementos da homepage. A seção de categorias da homepage apresenta a sequência Calma, Mente, Caos, Incolor, Fúria, Corpo e Ordem.

O changelog da homepage é editável em `js/home.js`, no array `CHANGELOG_ENTRIES`. Cada entrada aceita `date` e `description`; adicione, edite ou remova objetos desse array. A janela mantém o título visível e limita a área de rolagem a vinte linhas de altura.

As listas Mainboard e Sideboard exibem miniaturas compactas e permitem abrir a visualização da carta ao selecionar a miniatura. A marca no cabeçalho utiliza `assets/images/icon.webp`; preserve esse asset junto de `card-back.webp` no diretório `assets/images/`.


## Registro de coleções

As páginas de Glossário, Deckbuilder, Tiermaker e Playground compartilham o carregador de dados de `js/data.js`. Para incluir todas as coleções no catálogo, mantenha `data/collections/index.json` com uma lista `collections`; cada entrada deve informar `id`, `name` e o caminho relativo ao JSON da coleção em `path`. Exemplo:

```json
{
  "collections": [
    { "id": "flowerpower", "name": "Flower Power", "path": "data/collections/flowerpower.json" },
    { "id": "outra-colecao", "name": "Outra coleção", "path": "data/collections/outra-colecao.json" }
  ]
}
```

Os IDs das cartas precisam ser únicos entre todas as coleções registradas. Se o manifesto não existir, o carregador usa a coleção Flower Power pelos caminhos legados.

## Tiermaker

A página `tiermaker.html` usa o mesmo catálogo carregado pelo Glossário. Cartas podem ser arrastadas do catálogo para um tier, entre tiers, reordenadas dentro de um tier ou devolvidas ao catálogo. Também é possível selecionar uma carta e usar o seletor de destino, inclusive em dispositivos sem drag-and-drop. Nome, cor e ordem de cada tier são editáveis; tiers podem ser adicionados ou removidos. A classificação é salva automaticamente no `localStorage` (`trick.tiermaker.v1`) e pode ser exportada como PNG. O botão de limpar restaura os tiers iniciais e devolve todas as cartas ao catálogo.

## Playground

A página `playground.html` oferece uma mesa livre e um catálogo pesquisável. O botão `+` adiciona uma instância da carta; cada instância pode ser movida sem restrições de deck. Arrastar uma carta para fora dos limites da mesa a remove. A mesa é salva automaticamente no `localStorage` (`trick.playground.v1`) e pode ser esvaziada pelo botão de limpeza.

O CSS existente em `css/styles.css` foi preservado. Os estilos específicos das novas ferramentas e o ajuste de visibilidade do botão `.pool-add` ficam em `css/tools.css`, carregado depois da folha principal para evitar sobrescrever as personalizações já existentes.
