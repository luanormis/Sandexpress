#!/usr/bin/env node

const https = require('https');

const SUPABASE_URL = 'https://ukovhjjwcbtflrlmrjte.supabase.co';
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_uZ7uONOnuG6mizdamcg80w_hOGn4EVP';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrb3Zoamp3Y2J0ZmxybG1yanRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTg1Njc4MCwiZXhwIjoyMDkxNDMyNzgwfQ._Dh8y-ZhABFjY9aAhij4HrFVzQx-JYQQ0lCcDehA87I';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const options = {
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: res.statusCode === 200 ? JSON.parse(data) : data,
            headers: res.headers
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers
          });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('\n🧪 TESTE DE CONEXÃO - SUPABASE\n');
  console.log('='.repeat(50));
  
  try {
    // Teste 1: Health check
    console.log('\n1️⃣  Verificando saúde da API...');
    const health = await makeRequest('/rest/v1/');
    console.log(`   Status: ${health.status}`);
    if (health.status === 200) {
      console.log('   ✅ API está online');
    }
    
    // Teste 2: Listar vendors
    console.log('\n2️⃣  Consultando tabela "vendors"...');
    const vendors = await makeRequest('/rest/v1/vendors?limit=1');
    console.log(`   Status: ${vendors.status}`);
    if (vendors.status === 200) {
      console.log(`   ✅ Tabela acessível (${Array.isArray(vendors.data) ? vendors.data.length : 0} registros)`);
    } else {
      console.log(`   ❌ Erro: ${vendors.status}`);
    }
    
    // Teste 3: Listar umbrellas
    console.log('\n3️⃣  Consultando tabela "umbrellas"...');
    const umbrellas = await makeRequest('/rest/v1/umbrellas?limit=1');
    console.log(`   Status: ${umbrellas.status}`);
    if (umbrellas.status === 200) {
      console.log(`   ✅ Tabela acessível (${Array.isArray(umbrellas.data) ? umbrellas.data.length : 0} registros)`);
    } else {
      console.log(`   ❌ Erro: ${umbrellas.status}`);
    }
    
    // Teste 4: Listar orders
    console.log('\n4️⃣  Consultando tabela "orders"...');
    const orders = await makeRequest('/rest/v1/orders?limit=1');
    console.log(`   Status: ${orders.status}`);
    if (orders.status === 200) {
      console.log(`   ✅ Tabela acessível (${Array.isArray(orders.data) ? orders.data.length : 0} registros)`);
    } else {
      console.log(`   ❌ Erro: ${orders.status}`);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO\n');
    
  } catch (error) {
    console.log('\n❌ ERRO DURANTE O TESTE:');
    console.log(`   ${error.message}\n`);
    process.exit(1);
  }
}

runTests();
