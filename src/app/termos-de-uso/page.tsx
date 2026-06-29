import Link from "next/link";
import { TERMS_CONSENT_TEXT, TERMS_DOCUMENT_HASH, TERMS_DOCUMENT_TITLE, TERMS_VERSION } from "@/lib/terms";

const sections = [
  {
    title: "1. Apresentacao",
    body:
      "O SandExpress e uma plataforma tecnologica para gestao de pedidos por QR Code em quiosques, praias, bares, restaurantes, clubes, hoteis, condominios e estabelecimentos parceiros. A plataforma oferece recursos de cardapio digital, pedidos, atendimento, fechamento de conta, relatorios, gestao operacional e administracao do quiosque.",
  },
  {
    title: "2. Cadastro e responsabilidade do responsavel",
    body:
      "Para criar uma conta, o responsavel deve informar dados verdadeiros, completos e atualizados, incluindo nome, telefone, email, CPF ou CNPJ, nome do estabelecimento, praia, cidade, estado e senha de acesso. O responsavel declara possuir autorizacao para representar o estabelecimento e operar a conta cadastrada.",
  },
  {
    title: "3. Uso adequado da plataforma",
    body:
      "O usuario deve utilizar o SandExpress apenas para finalidades licitas. E proibido tentar acessar dados de outros estabelecimentos, manipular QR Codes, adulterar pedidos, compartilhar credenciais, praticar engenharia reversa, enviar scripts maliciosos, automatizar acessos nao autorizados ou gerar carga artificial no sistema.",
  },
  {
    title: "4. Responsabilidade do quiosque",
    body:
      "O quiosque ou estabelecimento parceiro e responsavel pela qualidade dos produtos, preparo, entrega, atendimento ao cliente, precos praticados, estoque, emissao de documentos fiscais e cumprimento das regras sanitarias e comerciais aplicaveis. O SandExpress atua como ferramenta tecnologica de apoio operacional.",
  },
  {
    title: "5. Dados coletados",
    body:
      "O SandExpress pode tratar dados do responsavel pelo quiosque, como nome, email, telefone, CPF ou CNPJ, dados de acesso, historico de uso e informacoes de pagamento quando aplicavel. Tambem pode tratar dados do cliente final, como nome, telefone, identificacao do pedido, local do pedido, QR Code utilizado, itens consumidos, horario e status do pedido.",
  },
  {
    title: "6. Finalidades do tratamento de dados",
    body:
      "Os dados sao utilizados para criar e gerenciar contas, autenticar usuarios, confirmar email, recuperar senha, validar WhatsApp, processar pedidos, identificar o quiosque responsavel, enviar comunicacoes operacionais, gerar relatorios, prestar suporte, prevenir fraudes, garantir seguranca, realizar cobrancas e cumprir obrigacoes legais.",
  },
  {
    title: "7. LGPD e bases legais",
    body:
      "O tratamento de dados pessoais observa a Lei Geral de Protecao de Dados. As bases legais podem incluir execucao de contrato, cumprimento de obrigacao legal ou regulatoria, legitimo interesse, consentimento quando necessario, exercicio regular de direitos e protecao do credito quando aplicavel.",
  },
  {
    title: "8. Compartilhamento de dados",
    body:
      "Dados podem ser compartilhados somente quando necessario para operar a plataforma, incluindo provedores de hospedagem, banco de dados, autenticacao, email, WhatsApp Business Platform, gateways de pagamento, ferramentas de monitoramento e autoridades publicas quando exigido por lei. O SandExpress nao vende dados pessoais.",
  },
  {
    title: "9. WhatsApp e comunicacoes",
    body:
      "O SandExpress pode utilizar WhatsApp para validacao, confirmacao de pedidos e comunicacoes operacionais. Ao iniciar conversa pelo WhatsApp, o usuario tambem fica sujeito as politicas da Meta/WhatsApp. Comunicacoes de seguranca, suporte, operacao e manutencao podem ser enviadas independentemente de preferencias de marketing.",
  },
  {
    title: "10. Cookies e dados tecnicos",
    body:
      "A plataforma pode utilizar cookies necessarios e tecnologias semelhantes para manter sessao, lembrar preferencias, melhorar seguranca, medir desempenho, identificar erros e prevenir fraudes. Tambem podem ser registrados IP, navegador, sistema operacional, dispositivo, logs de acesso, data e hora e identificadores de sessao.",
  },
  {
    title: "11. Seguranca da informacao",
    body:
      "O SandExpress adota medidas tecnicas e administrativas como HTTPS/TLS, autenticacao, controle de acesso, segregacao por tenant, Row Level Security no banco, logs de auditoria, tokens temporarios, expiracao de links sensiveis, limitacao de tentativas, armazenamento seguro de variaveis secretas, backups e monitoramento.",
  },
  {
    title: "12. Retencao, exclusao e anonimizacao",
    body:
      "Os dados serao mantidos pelo tempo necessario para cumprir as finalidades informadas, obrigacoes legais, auditoria, prevencao a fraude, defesa em processos, obrigacoes fiscais ou contratuais. Quando nao forem mais necessarios, poderao ser eliminados ou anonimizados conforme a legislacao aplicavel.",
  },
  {
    title: "13. Direitos do titular",
    body:
      "Nos termos da LGPD, o titular pode solicitar confirmacao de tratamento, acesso, correcao, anonimizacao, bloqueio, eliminacao, portabilidade quando aplicavel, informacao sobre compartilhamento, revogacao de consentimento e oposicao ao tratamento quando aplicavel.",
  },
  {
    title: "14. Planos, pagamentos, suspensao e cancelamento",
    body:
      "O uso da plataforma pode estar sujeito a planos gratuitos, promocionais ou pagos. Valores, periodicidade, limites e funcionalidades sao apresentados na contratacao e podem ser atualizados conforme politica comercial. Inadimplencia, fraude, violacao destes termos ou risco de seguranca podem causar suspensao, bloqueio ou cancelamento da conta.",
  },
  {
    title: "15. Aceite eletronico",
    body:
      "Ao marcar a opcao de aceite no cadastro, o usuario declara que leu, compreendeu e aceitou os Termos de Uso e a Politica de Privacidade do SandExpress. O sistema registra eletronicamente o aceite com versao, data e hora, identificacao do tenant/quiosque, IP, User-Agent, dados cadastrais relevantes e hash de integridade do documento aceito.",
  },
  {
    title: "16. Alteracoes dos termos",
    body:
      "Estes termos e a politica de privacidade podem ser atualizados para refletir mudancas legais, melhorias de seguranca, novas funcionalidades, ajustes comerciais ou evolucao da plataforma. Alteracoes relevantes podem exigir novo aceite antes da continuidade de uso.",
  },
  {
    title: "17. Contato",
    body:
      "Para duvidas sobre privacidade, protecao de dados, suporte ou uso da plataforma, utilize o canal oficial de atendimento do SandExpress: contato@sandexpress.com.br.",
  },
];

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-[#fff8f6] px-4 py-10 text-[#261812] sm:px-6">
      <article className="mx-auto max-w-4xl rounded-2xl border border-[#e2bfb0] bg-white p-6 shadow-sm sm:p-10">
        <Link href="/" className="text-sm font-bold text-[#FF6B00] hover:text-[#E56000]">
          Voltar para o cadastro
        </Link>

        <header className="mt-6">
          <p className="text-sm font-black uppercase text-[#FF6B00]">Documento unico de aceite</p>
          <h1 className="mt-2 text-3xl font-display font-bold sm:text-4xl">{TERMS_DOCUMENT_TITLE}</h1>
          <p className="mt-3 text-sm font-bold text-gray-500">Versao {TERMS_VERSION}</p>
          <p className="mt-1 break-all text-xs text-gray-400">Hash SHA-256: {TERMS_DOCUMENT_HASH}</p>
        </header>

        <div className="mt-8 rounded-2xl border border-[#e2bfb0] bg-[#fff8f6] p-5">
          <h2 className="text-lg font-bold text-gray-900">Texto do aceite</h2>
          <p className="mt-2 text-sm leading-7 text-gray-700">{TERMS_CONSENT_TEXT}</p>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700 sm:text-base">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
