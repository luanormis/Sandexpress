import Link from "next/link";
import { TERMS_VERSION } from "@/lib/terms";

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-[#fff8f6] px-4 py-10 text-[#261812] sm:px-6">
      <article className="mx-auto max-w-4xl rounded-2xl border border-[#e2bfb0] bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-bold text-[#FF6B00] hover:text-[#E56000]">
          Voltar para o cadastro
        </Link>
        <h1 className="mt-6 text-3xl font-display font-bold sm:text-4xl">Termos de Uso SandExpress</h1>
        <p className="mt-2 text-sm font-bold text-gray-500">Versao {TERMS_VERSION}</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700 sm:text-base">
          <section>
            <h2 className="text-xl font-bold text-gray-900">1. Objeto</h2>
            <p>
              O SandExpress e um software de atendimento para quiosques, barracas e operacoes de praia. A plataforma
              permite cadastro do estabelecimento, cardapio digital, pedidos por QR Code, acompanhamento de mesas,
              fechamento de conta, gestao de produtos, usuarios da equipe, relatorios e recursos operacionais.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">2. Cadastro e responsabilidade</h2>
            <p>
              Ao criar uma conta, o responsavel declara que as informacoes fornecidas sao verdadeiras e que possui
              autorizacao para operar o quiosque cadastrado. O responsavel deve manter telefone, email, CPF ou CNPJ,
              cidade, estado, praia e dados do estabelecimento atualizados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">3. Dados tratados</h2>
            <p>
              Para prestar o servico, o SandExpress pode tratar nome do responsavel, telefone, email, CPF, CNPJ, nome do
              quiosque, praia, cidade, estado, dados de clientes atendidos, pedidos, itens vendidos, valores, metodo de
              pagamento, horario de atendimento, mesas ou guarda-sois e registros tecnicos de acesso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">4. Finalidade de uso dos dados</h2>
            <p>
              Os dados sao usados para criar e manter a conta, autenticar usuarios, operar pedidos, exibir cardapios,
              fechar contas, gerar relatorios, prestar suporte, melhorar a plataforma, cumprir obrigacoes legais e
              proteger a seguranca do sistema.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">5. Planos e pagamentos</h2>
            <p>
              A plataforma pode oferecer periodo de teste e planos pagos. Os valores, limites e condicoes comerciais
              exibidos no momento da contratacao prevalecem sobre informacoes promocionais antigas. A falta de pagamento
              pode gerar bloqueio ou suspensao do acesso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">6. Pedidos, contas e relatorios</h2>
            <p>
              O quiosque e responsavel pela conferencia dos pedidos, precos, produtos, entrega e recebimento dos valores.
              O SandExpress registra as informacoes operacionais para consulta, relatorios e auditoria interna do
              estabelecimento.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">7. Arquivamento de historico</h2>
            <p>
              Para manter desempenho e liberar espaco no banco principal, pedidos pagos podem ser removidos das tabelas
              operacionais e preservados em armazenamento privado para consumo posterior por relatorios e auditorias.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">8. LGPD e privacidade</h2>
            <p>
              O responsavel pelo quiosque deve informar seus clientes sobre o uso dos dados no atendimento. Quando
              aplicavel, o SandExpress atua como operador dos dados do quiosque e adota medidas razoaveis para proteger
              informacoes pessoais contra acesso indevido.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">9. Uso adequado</h2>
            <p>
              E proibido usar a plataforma para fraude, conteudo ilegal, acesso nao autorizado, engenharia reversa,
              tentativa de burlar limites tecnicos ou qualquer atividade que prejudique outros usuarios ou a operacao do
              servico.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900">10. Alteracoes</h2>
            <p>
              Estes termos podem ser atualizados para refletir melhorias, mudancas legais ou novas funcionalidades. A
              continuidade de uso apos atualizacao representa concordancia com a versao vigente.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
