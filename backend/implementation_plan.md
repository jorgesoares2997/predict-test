# Transição para Supabase Local via CLI

Vamos migrar o banco de dados do projeto para usar o PostgreSQL local oferecido pelo Supabase CLI. Isso garante paridade total com o ambiente de produção do Supabase.

## User Review Required

- O **Supabase CLI** usa contêineres para rodar os serviços locais. Você precisa estar com o **Docker Desktop** (ou OrbStack/Colima) aberto e rodando no seu Mac antes de seguirmos.

## Proposed Changes

### Backend (.env)
- Adicionar `DATABASE_URL` apontando para o banco PostgreSQL local do Supabase (porta 54322).
- Adicionar `DIRECT_URL` para o Prisma Client.

### Backend (prisma/schema.prisma)
#### [MODIFY] schema.prisma
- Configurar o `datasource db` para usar o `url` e `directUrl` vindos do `.env`.

### Comandos a serem executados
1. Inicializar o Supabase CLI: `npx supabase init`
2. Subir os contêineres do Supabase: `npx supabase start`
3. Sincronizar o schema do Prisma com o novo banco: `npx prisma db push`

## Verification Plan
- Rodar o backend localmente e verificar se ele consegue conectar no banco do Supabase e criar um novo mercado.
