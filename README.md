# Otamerica | SENTINEL

Controle de validade de certificados e calibrações de equipamentos (NR-10, manômetros e demais ativos).
Aplicação estática (HTML + CSS + JavaScript, sem build) apoiada por um Web App do Google Apps Script.

---

## Como rodar

```bash
npm run serve        # http://localhost:8080
npm test             # datas, status, filtros, esquema e versão do service worker
npm run build        # carimba no sw.js a versão derivada do conteúdo
```

Precisa ser servido por HTTP: o app usa módulos ES, que não funcionam abrindo o
arquivo direto (`file://`). O modo offline exige contexto seguro — funciona em
`localhost` no desenvolvimento e em **HTTPS** em produção.

## Estrutura

```
index.html                  Marcação e sprite de ícones
manifest.webmanifest        Instalação como aplicativo (PWA)
sw.js                       Service worker: cache do app e da última base
vercel.json                 Cabeçalhos de cache/segurança e build da publicação
scripts/build-sw.mjs        Versiona o service worker pelo conteúdo do app
assets/css/styles.css       Tema, layout responsivo e impressão
assets/icons/               Ícones do aplicativo instalado
assets/js/
  config.js                 ⚙️ Único arquivo a editar: URL da API, token, prazos, senha
  utils.js                  Datas, escaping, diálogos, toasts, QR
  status.js                 Rótulos e cores de status
  api.js                    Acesso ao backend (nenhum outro módulo faz fetch)
  session.js                Identidade do operador (nome ou login Google)
  pwa.js                    Registro do service worker e estado da conexão
  store.js                  Estado, normalização, status, filtros, seleções
  actions.js                Escritas (autorização + verificação do efeito)
  exporters.js              PDF, Excel e etiquetas QR
  main.js                   Rotas, eventos e tarefas periódicas
  views/                    dashboard, tables, modal, charts, register, admin, audit
tests/                      Testes automatizados (node:test, sem dependências)
backend/Code.gs.example     Apps Script: esquema, token, auditoria e alertas
```

---

## Publicar no Vercel

O projeto é estático: não há framework a escolher.

1. **Importe o repositório** em vercel.com → *Add New* → *Project*.
2. Em *Framework Preset* escolha **Other**. Não mexa em Build/Output: o
   `vercel.json` já define tudo.
3. *Deploy*. A URL sai em HTTPS, que é o que liga o modo offline.
4. Copie a URL e preencha:
   - `assets/js/config.js` → `APP_URL` (usada nos QR Codes das etiquetas);
   - `backend/Code.gs.example` → `CONFIG.APP_URL` (links do e-mail de alerta).

O que o `vercel.json` faz:

- **`buildCommand`** roda `scripts/build-sw.mjs` a cada publicação — é o item 2
  resolvido (detalhe abaixo).
- **Cache-Control revalidado** em `sw.js`, HTML, manifesto e `assets/`. Sem isso
  o CDN da Vercel poderia servir arquivos antigos por horas depois de publicar.
- **Cabeçalhos de segurança**, incluindo um CSP que libera só os CDNs realmente
  usados. Se algum recurso novo for bloqueado, o console do navegador diz
  exatamente qual diretiva faltou — acrescente o domínio lá.

> Se a publicação falhar no passo de build, apague a linha `buildCommand` do
> `vercel.json` e rode `npm run build` antes de cada commit. Todo o resto
> continua funcionando.

### Versão do service worker (item 2)

O navegador só instala um service worker novo se **o arquivo `sw.js` mudar**. Se
o HTML/CSS/JS mudarem e o `sw.js` continuar idêntico, quem já abriu o app segue
com a versão em cache — publicar uma correção que nunca chega em ninguém.

`npm run build` resolve isso sem depender de memória: a versão passa a ser o
**hash do conteúdo** dos arquivos que o service worker pré-carrega. Muda quando
(e só quando) o app muda.

```
$ npm run build
sw.js: v3.0.0 → v2aa4ac5b71fa (22 arquivos)
```

Três camadas garantem que não passe batido:

1. no Vercel, o `buildCommand` roda sozinho a cada publicação;
2. `npm test` falha se o `sw.js` versionado estiver defasado;
3. o mesmo teste confere que todo módulo importado está no `SHELL_ASSETS` —
   senão o app quebraria offline ao abrir uma tela ainda não visitada.

Quando há versão nova, o app não troca a aplicação por baixo de quem está
trabalhando: mostra **"Atualizar agora"** e espera o clique.

## Configuração

Tudo em `assets/js/config.js`:

| Chave | Para que serve |
|---|---|
| `API_URL` | URL `/exec` do Apps Script |
| `API_TOKEN` | Token enviado em toda requisição (vazio = desligado) |
| `WRITE_MODE` | `no-cors` (padrão) ou `cors` quando o backend devolver JSON |
| `WARN_DAYS` | Dias de antecedência do alerta amarelo, por categoria |
| `PERIODICITY_MONTHS` | Periodicidade padrão de calibração, por categoria |
| `BLOCK_ON_REJECTED` | Certificado reprovado invalida o equipamento no prazo |
| `AUTH.GOOGLE_CLIENT_ID` | Ativa o login Google (vazio = só identificação por nome) |
| `AUTH.REQUIRE_IDENTITY` | Exige um responsável identificado antes de escrever |
| `AUTH.DEFAULT_ROLE` | Papel padrão: `leitor`, `editor` ou `admin` |
| `REFRESH_INTERVAL_MS` | Recarga automática da base |
| `ADMIN_PASSCODE` | Senha da área ADM (apenas conveniência de interface) |
| `PAGE_SIZE` | Cards renderizados por vez no painel |

---

## ⚠️ Segurança — leia antes de publicar

O backend atual **não tem autenticação**. Como a `API_URL` fica visível no
navegador de qualquer visitante, quem tiver o endereço do site pode ler a base,
inativar equipamentos, alterar validades e substituir bases inteiras.

A senha da área ADM **não protege nada**: ela viaja no código-fonte e apenas
mostra/esconde um painel. A autorização precisa estar no servidor.

Passos recomendados, em ordem:

1. **Republique o Apps Script com uma URL nova** (a anterior foi compartilhada) e
   troque `ADMIN_PASSCODE`.
2. Instale `backend/Code.gs.example`, que já valida `token` em toda requisição,
   e preencha `API_TOKEN` no `config.js`. Isso barra acesso casual — não é
   autenticação forte, já que o token também vai no cliente.
3. Para proteção real, restrinja a implantação a contas do domínio da empresa
   ("Executar como: usuário que acessa" + "Quem pode acessar: usuários de
   <sua organização>"), ou migre para um backend com login.

## Backend: instalar em 5 minutos

`backend/Code.gs.example` é o script completo — cole por cima do que estiver no
editor do Apps Script (Planilha → Extensões → Apps Script).

1. Preencha o bloco `CONFIG` no topo: `SHEET_ID`, `TOKEN`, `DIGEST_TO` e `APP_URL`.
2. Selecione a função **`setup`** na lista do editor e clique em **Executar**.
   Autorize quando o Google pedir. O log mostra o que foi feito.
3. **Implantar → Nova implantação → App da Web**
   (Executar como: *Eu*; Quem pode acessar: *Qualquer pessoa*).
4. Copie a URL `/exec` para `assets/js/config.js` → `API_URL`, e repita o mesmo
   token em `API_TOKEN`.

### As colunas se criam sozinhas

Não é preciso preparar a planilha à mão. O `setup` cria as abas que faltarem
(`NR10`, `MANOMETRO`, `OUTROS`, `AUDITORIA`, `USUARIOS`, `SUGESTOES`) e
acrescenta as colunas ausentes — inclusive as de metrologia da Fase 2.

Duas garantias importantes:

- **Nada é apagado nem reordenado.** Colunas novas entram no fim, então uma
  planilha antiga continua válida e os dados existentes ficam onde estão.
- **É idempotente e contínuo.** Rodar `setup` de novo não duplica nada, e toda
  escrita passa por `sheetFor()`, que reconfere o esquema. Se alguém apagar uma
  coluna sem querer, ela volta no próximo cadastro em vez de derrubar a operação.

Para acrescentar um campo novo no futuro: adicione o par
`['campo', 'CABEÇALHO']` em `FIELDS` (backend) e o campo em `FORM_CONFIG`
(`assets/js/config.js`), e rode `setup`. `npm test` avisa se as duas pontas
saírem de sincronia — um campo sem coluna correspondente seria descartado em
silêncio pelo backend.

## Alertas por e-mail (item 3)

É o que faz o sistema deixar de ser passivo: em vez de esperar alguém abrir o
painel, ele avisa. Já está pronto — falta ligar.

1. No editor do Apps Script, selecione **`testDigest`** e execute. Ele **não
   envia nada**: monta o resumo e escreve no log (Ver → Registros). Confira o
   conteúdo.
2. Selecione **`installDigestTrigger`** e execute. Pronto: toda segunda-feira às
   7h o resumo sai para `CONFIG.DIGEST_TO`.
   *(Se você já rodou `setup`, o acionador foi criado ali — este passo é só para
   reinstalar ou mudar o horário.)*
3. Confira em **Acionadores** (ícone de relógio, à esquerda) que
   `sendExpiryDigest` está agendado.

O e-mail traz duas tabelas — **vencidos/bloqueados** e **vencem em até
`DIGEST_WARN_DAYS` dias** — com TAG, equipamento, local, vencimento e quantos
dias faltam. Cada TAG é um link direto para a ficha no app, e cada tabela tem um
link para o painel já filtrado. Certificado **reprovado** entra junto dos
vencidos mesmo dentro do prazo, na mesma regra que o painel usa.

Se não houver nada a reportar, o e-mail não é enviado — para o alerta não virar
ruído que todo mundo aprende a ignorar.

Para mudar o horário ou a frequência, edite `installDigestTrigger`
(`.onWeekDay(...).atHour(...)`, ou `.everyDays(1)` para diário) e execute de
novo — ele remove o acionador anterior antes de criar o novo.

## Identidade, papéis e auditoria

Toda escrita passa por um portão único (`actions.authorize`): exige um
responsável identificado e o papel adequado, e anexa o autor à requisição.

**Sem `GOOGLE_CLIENT_ID`** (padrão): o app pede o nome do responsável na
primeira alteração e o guarda na sessão. Isso é **identificação, não
autenticação** — serve para rastreabilidade, não impede ninguém de mentir.

**Com `GOOGLE_CLIENT_ID`**: o usuário entra com a conta Google e o app envia o
ID token em cada escrita. Só vira segurança de verdade quando o Apps Script
valida esse token (`verifyIdToken` no exemplo de backend) — o front decodifica
o JWT apenas para exibir nome e e-mail.

Papéis (aba `USUARIOS` no backend, colunas `EMAIL | PAPEL`):

| Papel | Pode |
|---|---|
| `leitor` | apenas consultar |
| `editor` | cadastrar, atualizar validade, inativar |
| `admin` | tudo, inclusive substituir bases por CSV |

A checagem no cliente serve para a interface; a que vale é a do backend.

A tela **Auditoria** lê o log do servidor (`action=audit`) e mostra quando,
o quê, em qual TAG e por quem. Enquanto o Apps Script não expuser esse
endpoint, a tela explica o que falta em vez de quebrar.

## Periodicidade e metrologia

O cadastro tem campos de **laboratório/organismo calibrador, resultado,
incerteza de medição, erro máximo admissível e periodicidade**. A validade é
calculada sozinha a partir de *data de certificação + periodicidade* (e a soma
respeita o fim do mês: 31/01 + 1 mês = 28/02). Digitar a data à mão desliga o
cálculo, com aviso na tela.

Na gestão em massa, além da data fixa existe o modo **renovar por
periodicidade**: cada equipamento recebe a própria data nova, calculada a
partir da validade atual (encadeia sem intervalo descoberto) ou de hoje. A
prévia mostra item a item o que vai mudar antes de confirmar.

Um certificado com resultado **REPROVADO** marca o equipamento como vencido
mesmo dentro do prazo, com aviso na ficha e coluna própria no Excel. Desligue
em `CONFIG.BLOCK_ON_REJECTED` se a sua operação tratar reprovação apenas como
histórico.

> ⚠️ Os campos novos só são gravados se a planilha tiver as colunas
> correspondentes (`PERIODICIDADE (MESES)`, `LABORATÓRIO / ORGANISMO
> CALIBRADOR`, `RESULTADO`, `INCERTEZA DE MEDIÇÃO`, `ERRO MÁXIMO ADMISSÍVEL`).
> Sem elas, o backend descarta o valor silenciosamente.

## Uso offline (PWA)

O app é instalável (Adicionar à tela de início, no celular; ícone de instalar,
no navegador) e continua **consultável sem rede**, que é a situação real de quem
escaneia a etiqueta de um equipamento no meio da planta.

Funciona offline:

- abrir o app, navegar entre telas, filtrar e buscar;
- consultar a ficha, o histórico e os dados de metrologia;
- ver a última base baixada, com o rótulo **"Cópia local de HH:MM"** no lugar de
  "Atualizado" e uma faixa amarela no topo.

Não funciona offline — e o app diz isso claramente:

- cadastrar, atualizar validade, inativar ou importar CSV.

**Por que não há fila de reenvio.** Guardar as alterações para enviar quando a
rede voltar parece atraente, mas no modo `no-cors` a resposta do POST é opaca:
não dá para saber se a primeira tentativa chegou. Uma fila arriscaria aplicar a
mesma alteração duas vezes em um sistema de conformidade. Preferimos bloquear e
avisar. Se um dia o backend passar a responder JSON (`WRITE_MODE: 'cors'`),
a fila passa a ser segura e vale implementar.

### Ao publicar uma versão nova

Incremente `VERSION` em `sw.js`. Sem isso, quem já usou o app continua com a
versão em cache. Quando há versão nova, o app avisa com um botão
**"Atualizar agora"** em vez de trocar a aplicação por baixo de quem está no
meio de uma tarefa.

## Modo de escrita e confirmação

Com `WRITE_MODE: 'no-cors'` o navegador **não deixa ler a resposta** do POST: não
há como saber se o servidor aceitou a operação. Por isso toda escrita recarrega a
base e confere o efeito esperado (`actions.js` → `store.verifyWrite`):

- efeito confirmado → "Equipamento inativado."
- envio feito mas efeito não confirmado → aviso pedindo conferência na planilha
- falha de rede → erro explícito

Depois de publicar o `doPost` do exemplo (que devolve JSON), mude
`WRITE_MODE` para `'cors'` e o app passa a reportar a mensagem de erro real do
servidor.

---

## Decisões de implementação

**Datas são datas de calendário, não instantes.** Toda data passa por
`utils.parseDate`, que normaliza `dd/mm/aaaa`, `aaaa-mm-dd`, ISO com hora, `Date`
e epoch para a meia-noite local, e rejeita datas inexistentes (31/02). Nunca use
`new Date(isoString)` para exibir: o resultado muda de dia conforme o fuso.

**Seleções em massa são guardadas por TAG.** Índices de array mudam a cada
recarga da base e passariam a apontar para outro equipamento.

**Nada vai para a tela sem `esc()`.** Os dados vêm de uma planilha alimentada por
CSV; sem escaping, uma célula com HTML executa código no navegador de todo mundo.

**QR Code aponta para a ficha online** (`?tag=XYZ`), não para um JSON congelado.
A etiqueta colada no equipamento continua correta depois de uma renovação.

**Equipamento sem data tem status próprio** ("SEM DATA") e filtro próprio. Antes
esses itens não apareciam em nenhum filtro de status e o total não fechava.

---

## O que mudou em relação à versão anterior

### Correções

- Datas em ISO deixavam todos os equipamentos com status "N/A" e fora dos filtros.
- Datas exibidas um dia antes do real por causa do fuso horário.
- Seleção em massa por índice podia inativar/alterar o equipamento errado.
- "Dados enviados com sucesso!" aparecia mesmo quando o servidor recusava.
- Overlay de carregamento travava para sempre se uma requisição falhasse.
- Injeção de HTML a partir de células da planilha (XSS); categorias com apóstrofo quebravam a tela.
- Exportações incluíam equipamentos já inativados.
- Busca inconsistente entre telas (a exportação só procurava na TAG).
- `31/02/2025` era aceito e virava 03/03.
- Contagem de dias congelava em painéis deixados abertos (não virava o dia).

### Melhorias

- Módulos separados, com testes automatizados das regras de data e status.
- Layout responsivo (o app não abria em celular — justamente onde o QR é lido).
- Foco visível, navegação por teclado, `Esc` fecha modais, status nunca só por cor.
- Toasts e diálogos no lugar de `alert`/`confirm`/`prompt`.
- Exclusão em massa mostra a lista do que será inativado; importação de CSV tem
  pré-visualização, detecção de separador errado e confirmação por digitação.
- Ordenação por coluna, estados vazios, paginação, busca com debounce.
- Aviso de TAG duplicada no cadastro.
- Links compartilháveis (`?view=`, `?status=`, `?tag=`).
- Versões de CDN fixas e degradação graciosa quando um CDN não carrega.

---

### Fase 2

- Identidade do operador e autor em toda escrita, com papéis (leitor/editor/admin).
- Login Google opcional, com validação do token no backend.
- Tela de auditoria (quando, o quê, qual TAG, quem).
- Periodicidade por equipamento, com validade calculada e renovação em massa.
- Campos de metrologia: laboratório, resultado, incerteza e erro máximo admissível.
- Certificado reprovado invalida o equipamento mesmo dentro do prazo.

### Fase 3

- Instalável como aplicativo e consultável sem rede (service worker + manifesto).
- Faixa de offline, rótulo "cópia local" e bloqueio explícito de escrita sem rede.
- Aviso de versão nova com atualização sob demanda.
- `installDigestTrigger()` no backend: agenda o resumo semanal com um clique.

### Fase 4

- Backend cria abas e colunas que faltarem, sem apagar nem reordenar o que existe.
- `setup()` faz a instalação inteira em uma execução.
- Resumo de vencimentos em HTML, com links diretos para a ficha e para o painel.
- Publicação no Vercel: cabeçalhos de cache, CSP e versionamento automático do
  service worker pelo hash do conteúdo.
- Testes de esquema: campo de formulário sem coluna no backend, ou service
  worker defasado, quebram o `npm test`.

---

## Próximos passos sugeridos

1. **Depois de publicar**, teste uma escrita de ponta a ponta (cadastre um
   equipamento de teste e inative-o) e confira a aba AUDITORIA. Só então mude
   `WRITE_MODE` para `'cors'` e confirme que os erros do servidor aparecem na
   tela.
2. **Login Google** — crie o ID de cliente OAuth, preencha `GOOGLE_CLIENT_ID`
   nas duas pontas e cadastre os papéis na aba USUARIOS. É o passo que troca
   "identificação" por autenticação de verdade.
3. **Planos de calibração** — agendar o envio ao laboratório e acompanhar o
   retorno, fechando o ciclo entre "vai vencer" e "foi calibrado".
4. **Fila de escritas offline** — só depois de `WRITE_MODE: 'cors'` (ver acima).
