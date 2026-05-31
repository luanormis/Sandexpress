import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gezyqoxqqnpbnxuapxus.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlenlxb3hxcW5wYm54dWFweHVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDk4MjIsImV4cCI6MjA5NTU4NTgyMn0.eKovCWGe06dbaV5QAoU0rXPyna0N7br5aKUDrK0wK1c';

async function testConnection() {
  console.log('🔍 Testando conexão com Supabase...');
  console.log(`📍 URL: ${supabaseUrl}`);
  
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Teste 1: Ping simples
    console.log('\n✅ Cliente Supabase criado com sucesso');
    
    // Teste 2: Tentar acessar uma tabela básica
    const { data, error } = await supabase
      .from('vendors')
      .select('id')
      .limit(1);
    
    if (error) {
      console.log('❌ Erro ao consultar tabela vendors:');
      console.log(error);
      return false;
    }
    
    console.log('✅ Conexão com banco de dados estabelecida com sucesso!');
    console.log(`📊 Amostra de dados recebida: ${data?.length || 0} registro(s)`);
    return true;
    
  } catch (err: any) {
    console.error('❌ Erro de conexão:', err?.message || err);
    return false;
  }
}

testConnection().then(success => {
  process.exit(success ? 0 : 1);
});
