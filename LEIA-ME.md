# Área de membros — Vídeos com IA

Site estático + 4 funções na Vercel. Sem banco de dados e sem build.

## Cursos e planos

A área tem três cursos, definidos em `content/cursos.json`. Cada curso lista os produtos da Cakto que o liberam:

| Curso | Liberado por |
|---|---|
| `manual` — Manual escrito | Manual, Completo, Completo + YouTube |
| `shorts` — Curso completo em vídeo | Completo, Completo + YouTube |
| `youtube` — Vídeos longos para o YouTube (`"embreve": true`) | Completo + YouTube |

Antes de publicar, troque `ID_PRODUTO_MANUAL`, `ID_PRODUTO_COMPLETO` e `ID_PRODUTO_COMPLETO_YOUTUBE` pelos IDs (UUID) reais dos produtos na Cakto. Em `"checkout"`, coloque o link de compra do plano. Quem não tem o curso vê o cartão bloqueado com o botão "Quero liberar".

Um curso com `"embreve": true` aparece com o selo "Em breve" e não abre.

Uma aula com `"bloqueada": "texto"` no `modulos.json` aparece com cadeado e mostra só esse texto; o conteúdo dela nunca é entregue. Para liberar, apague a linha `"bloqueada"`.

## Como o acesso funciona

1. O aluno digita o e-mail em `/`.
2. O servidor consulta a **API da Cakto**, pega os pedidos `paid` desse e-mail e libera os cursos ligados a esses produtos.
3. Se houver ao menos um curso, o aluno entra na hora, em qualquer aparelho, com uma sessão (cookie HttpOnly, 30 dias). Não há envio de e-mail.
4. A cada 5 minutos de uso, as compras são revalidadas na Cakto. Pedido `refunded` ou `chargedback` deixa de contar e o curso é bloqueado.

Aulas, prints e vídeos ficam em `content/<curso>/`, fora da pasta pública. Eles só são entregues pelas rotas `/api/conteudo` e `/api/media`, e só dos cursos que o aluno comprou.

## Configurar (uma vez)

1. **Cakto:** em Integrações > Cakto API, crie uma chave com leitura de pedidos. Guarde o `client_id` e o `client_secret`. Copie os IDs dos três produtos para o `content/cursos.json`.
2. **Vercel:** crie um projeto novo apontando para este repositório (Framework Preset: Other). Em Settings > Environment Variables, cadastre as variáveis do `.env.example`.
3. Se quiser, aponte um subdomínio (ex.: `membros.seudominio.com.br`) para o projeto.
4. No checkout da Cakto, coloque o link da área de membros como página de obrigado ou de acesso.

## Editar o conteúdo

Não precisa mexer no código. Edite, faça commit e push: a Vercel publica sozinha. Cada curso tem a mesma estrutura em `content/<curso>/`:

- **Ordem, títulos e descrições:** `modulos.json`. Para reordenar, mova os blocos. Para criar uma aula, adicione `{ "id": "...", "titulo": "..." }` e crie `aulas/<id>.md`.
- **Texto da aula:** `aulas/<id>.md`, em Markdown (`## Título`, `**negrito**`, listas, `[texto](https://link)`).
- **Imagem:** coloque em `media/<pasta>/` e use `![descrição](media/m4/arquivo.webp)`.
- **Vídeo:** `<video class="vertical" controls preload="none" playsinline src="media/m7/arquivo.mp4" poster="media/m7/arquivo.jpg"></video>` (sem `class="vertical"` para vídeo deitado).
- **Arquivo para baixar:** `[Baixar o arquivo](media/apoio/arquivo.txt)`.
- **Bloco para copiar (prompt):** coloque o texto entre três crases. O botão "Copiar" aparece sozinho.
- **Espaço reservado:** `<p class="pending">O que vai entrar aqui.</p>`.

Prefira imagens `.webp` de até 1600 px de largura.

## Vídeos grandes

Os vídeos são entregues pela função `/api/media` em pedaços de 3 MB, e a Vercel limita o tamanho de cada função (250 MB). Com muitos vídeos (por exemplo, quando entrar o curso do YouTube), o ideal é hospedar os vídeos num serviço de streaming privado (Bunny Stream, Cloudflare Stream ou similar) e manter aqui só o link.

## Rodar no computador

```
node dev.mjs     # http://localhost:5180
node test.mjs    # em outro terminal, com o servidor rodando (veja o comentário no topo do arquivo)
```

Sem chaves no `.env`, a Cakto é simulada: os e-mails em `DEV_PAID` (padrão `aluno@teste.com`) compraram os produtos em `DEV_PRODUCTS` (padrão: todos).
