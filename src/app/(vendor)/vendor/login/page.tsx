"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

export default function VendorLogin() {
  const [document_login, setDocumentLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!document_login || !password) {
      setError('Informe CPF/CNPJ e senha.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/vendor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_login, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Falha no login.');
        return;
      }

      if (result.must_change_password) {
        alert('Faça a alteração da senha padrão no primeiro acesso.');
      }

      if (result.vendor_id) {
        sessionStorage.setItem('vendor_id', result.vendor_id);
        localStorage.setItem('vendor_id', result.vendor_id);
      }
      router.push('/vendor/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setError('Erro ao conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-[#FF6B00] rounded-2xl flex items-center justify-center mb-6 shadow-xl">
        <UtensilsCrossed size={40} className="text-white" />
      </div>
      <h1 className="text-3xl font-display font-bold text-gray-900 mb-2">Painel do Quiosque</h1>
      <p className="text-gray-500 mb-8 max-w-sm">Entre com seu CPF/CNPJ e senha para gerenciar seus pedidos em tempo real.</p>
      {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <div>
          <input
            type="text"
            placeholder="CPF ou CNPJ"
            value={document_login}
            onChange={e => setDocumentLogin(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-4 text-left focus:border-[#FF6B00] focus:ring-0 outline-none"
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-4 text-left focus:border-[#FF6B00] focus:ring-0 outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#FF6B00] text-white font-bold py-4 rounded-xl text-lg shadow-md active:scale-95 transition-all mt-4 hover:bg-[#E56000] disabled:opacity-50"
        >
          {isLoading ? 'Conectando...' : 'Entrar no Painel'}
        </button>
      </form>
    </div>
  );
}
