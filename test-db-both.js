#!/usr/bin/env node

const https = require('https');

// Testar com ambas as URLs
const configs = [
  {
    name: 'URL do .env.local',
    url: 'https://ukovhjjwcbtflrlmrjte.supabase.co',
    key: 'sb_publishable_uZ7uONOnuG6mizdamcg80w_hOGn4EVP'
  },
  {
    name: 'URL anterior (gezyqox...)',
    url: 'https://gezyqoxqqnpbnxuapxus.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlenlxb3hxcW5wYm54dWFweHVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMDk4MjIsImV4cCI6MjA5NTU4NTgyMn0.eKovCWGe06dbaV5QAoU0rXPyna0N7br5aKUDrK0wK1c'
  }
];

function makeRequest(baseUrl, path, apiKey) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl + path);
    const options = {
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          success: true
        });
      });
    }).on('error', (err) => {
      resolve({
        status: 0,
        error: err.message,
        success: false
      });
    });
  });
}

async function runTests() {
  console.log('\n🧪 TESTE DE BANCO DE DADOS - SUPABASE\n');
  console.log('='.repeat(60));
  
  for (const config of configs) {
    console.log(`\n🔍 Testando: ${config.name}`);
    console.log(`   URL: ${config.url}`);
    
    try {
      const result = await makeRequest(config.url, '/rest/v1/', config.key);
      
      if (result.success) {
        console.log(`   ✅ Status: ${result.status}`);
        console.log(`   ✅ CONEXÃO BEM-SUCEDIDA`);
      } else {
        console.log(`   ❌ Erro: ${result.error}`);
      }
    } catch (err) {
      console.log(`   ❌ Erro inesperado: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

runTests();
