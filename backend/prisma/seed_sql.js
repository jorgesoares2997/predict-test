const { execSync } = require('child_process');

const categories = ['Cripto', 'Esportes', 'Política', 'Economia'];

console.log('🌱 Gerando SQL de seed...');

const sql = categories.map(name => {
  // UUID fixo para garantir que não mude em cada rodada se preferir, ou deixe o DB gerar.
  return `INSERT INTO "Category" (id, name) VALUES (gen_random_uuid(), '${name}') ON CONFLICT (name) DO NOTHING;`;
}).join('\n');

try {
  console.log('🚀 Executando SQL via Prisma...');
  // Usamos o comando "prisma db execute" que aceita SQL direto
  // Ele usa a URL definida no schema/env automaticamente
  execSync(`npx prisma db execute --stdin <<EOF\n${sql}\nEOF`, { stdio: 'inherit' });
  console.log('✅ Categorias criadas com sucesso!');
} catch (error) {
  console.error('❌ Erro ao executar SQL:', error.message);
  process.exit(1);
}
