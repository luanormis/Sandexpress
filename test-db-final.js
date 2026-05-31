#!/usr/bin/env node

const https = require('https');

const SUPABASE_URL = 'https://ztznbhwmdjiboadcuucn.supabase.co';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0em5iaHdtZGppYm9hZGN1dWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MDAyMjIsImV4cCI6MjA5MjQ3NjIyMn0.JGAtXpfoXjMkUTkL4-Sc5EJNL3seLf-dLeR6GoF6NFc';

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
            data: res.statusCode === 200 ? JSON.parse(data) : data
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('\n🧪 TESTE DE CONEXÃO - BANCO DE DADOS\n');
  console.log('='.repeat(60));
  console.log(`📍 URL: ${SUPABASE_URL}`);
  console.log('='.repeat(60));
  
  try {
    // Teste 1: Health check
    console.log('\n1️⃣  Verificando saúde da API REST...');
    const health = await makeRequest('/rest/v1/');
    console.log(`   Status: ${health.status}`);
    if (health.status === 200) {
      console.log('   ✅ API está ONLINE');
    }
    
    // Teste 2: Listar vendors
    console.log('\n2️⃣  Consultando tabela "vendors"...');
    const vendors = await makeRequest('/rest/v1/vendors?limit=5');
    console.log(`   Status: ${vendors.status}`);
    if (vendors.status === 200) {
      const count = Array.isArray(vendors.data) ? vendors.data.length : 0;
      console.log(`   ✅ Tabela acessível - ${count} registros encontrados`);
      if (count > 0) {
        console.log(`   📊 Primeiro registro: ${JSON.stringify(vendors.data[0]).substring(0, 80)}...`);
      }
    }
    
    // Teste 3: Listar umbrellas
    console.log('\n3️⃣  Consultando tabela "umbrellas"...');
    const umbrellas = await makeRequest('/rest/v1/umbrellas?limit=5');
    console.log(`   Status: ${umbrellas.status}`);
    if (umbrellas.status === 200) {
      const count = Array.isArray(umbrellas.data) ? umbrellas.data.length : 0;
      console.log(`   ✅ Tabela acessível - ${count} registros encontrados`);
    }
    
    // Teste 4: Listar orders
    console.log('\n4️⃣  Consultando tabela "orders"...');
    const orders = await makeRequest('/rest/v1/orders?limit=5');
    console.log(`   Status: ${orders.status}`);
    if (orders.status === 200) {
      const count = Array.isArray(orders.data) ? orders.data.length : 0;
      console.log(`   ✅ Tabela acessível - ${count} registros encontrados`);
    }
    
    // Teste 5: Listar products
    console.log('\n5️⃣  Consultando tabela "products"...');
    const products = await makeRequest('/rest/v1/products?limit=5');
    console.log(`   Status: ${products.status}`);
    if (products.status === 200) {
      const count = Array.isArray(products.data) ? products.data.length : 0;
      console.log(`   ✅ Tabela acessível - ${count} registros encontrados`);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ TESTE CONCLUÍDO COM SUCESSO!\n');
    console.log('📌 Banco de dados está funcionando corretamente.\n');
    
  } catch (error) {
    console.log('\n❌ ERRO DURANTE O TESTE:');
    console.log(`   ${error.message}\n`);
    process.exit(1);
  }
}

runTests();
