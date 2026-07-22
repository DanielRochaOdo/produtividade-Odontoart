# produtividade-Odontoart

## Supabase

O projeto usa `@supabase/supabase-js`. A aplicação utiliza a URL do projeto e a chave pública anon/publishable; a chave `service_role` fica restrita a tarefas administrativas locais e não deve ser usada no keepalive.

## Keepalive do Supabase Free

O workflow [supabase-keepalive.yml](.github/workflows/supabase-keepalive.yml) faz uma leitura mínima diária na API REST do Supabase às 03:17 UTC e também pode ser executado manualmente pela aba **Actions**.

A migration cria o endpoint mínimo `catalog_links`, sem dados sensíveis, com uma política RLS que permite somente `SELECT` para `anon`. Aplique as migrations no projeto Supabase antes de executar o workflow. Ele usa somente a chave pública e falha quando os secrets estão ausentes ou a API retorna algo diferente de HTTP 2xx.

Para cadastrar os secrets no GitHub, abra **Settings > Secrets and variables > Actions > New repository secret** e adicione:

- `SUPABASE_URL`: URL do projeto Supabase, por exemplo `https://seu-projeto.supabase.co`.
- `SUPABASE_ANON_KEY`: chave pública anon do projeto Supabase (ou a chave publishable equivalente).

O arquivo `.env.example` contém apenas placeholders e pode ser versionado. O arquivo `.env` continua ignorado pelo Git e não deve ser commitado.

Depois de revisar os arquivos alterados:

```bash
git add .github/workflows/supabase-keepalive.yml supabase/migrations/20260722120000_create_keepalive_catalog_links.sql .env.example .gitignore README.md
git commit -m "chore: adiciona keepalive do Supabase"
git push origin main
```

Para executar após o push, abra **Actions > Supabase keepalive > Run workflow**, selecione a branch `main` e confirme em **Run workflow**. Abra a execução criada e verifique o status **Success**.
