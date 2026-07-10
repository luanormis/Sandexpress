import Link from "next/link";
import { TERMS_CONSENT_TEXT, TERMS_DOCUMENT_HASH, TERMS_DOCUMENT_TITLE, TERMS_VERSION } from "@/lib/terms";

const sections = [
  {
    title: "1. Apresentação",
    body:
      "O SandExpress é uma plataforma tecnológica para gestão de pedidos por QR Code em quiosques, praias, bares, restaurantes, clubes, hotéis, condomínios e estabelecimentos parceiros. A plataforma oferece recursos de cardápio digital, pedidos, atendimento, fechamento de conta, relatórios, gestão operacional e administração do quiosque.",
  },
  {
    title: "2. Cadastro e responsabilidade do responsável",
    body:
      "Para criar uma conta, o responsável deve informar dados verdadeiros, completos e atualizados, incluindo nome, telefone, email, CPF ou CNPJ, nome do estabelecimento, praia, cidade, estado e senha de acesso. O responsável declara possuir autorização para representar o estabelecimento e operar a conta cadastrada.",
  },
  {
    title: "3. Uso adequado da plataforma",
    body:
      "O usuário deve utilizar o SandExpress apenas para finalidades lícitas. É proibido tentar acessar dados de outros estabelecimentos, manipular QR Codes, adulterar pedidos, compartilhar credenciais, praticar engenharia reversa, enviar scripts maliciosos, automatizar acessos não autorizados ou gerar carga artificial no sistema.",
  },
  {
    title: "4. Responsabilidade do quiosque",
    body:
      "O quiosque ou estabelecimento parceiro é responsável pela qualidade dos produtos, preparo, entrega, atendimento ao cliente, preços praticados, estoque, emissão de documentos fiscais e cumprimento das regras sanitárias e comerciais aplicáveis. O SandExpress atua como ferramenta tecnológica de apoio operacional.",
  },
  {
    title: "5. Dados coletados",
    body:
      "O SandExpress pode tratar dados do responsável pelo quiosque, como nome, email, telefone, CPF ou CNPJ, dados de acesso, histórico de uso e informações de pagamento quando aplicável. Também pode tratar dados do cliente final, como nome, telefone, identificação do pedido, local do pedido, QR Code utilizado, itens consumidos, horário e status do pedido.",
  },
  {
    title: "6. Finalidades do tratamento de dados",
    body:
      "Os dados são utilizados para criar e gerenciar contas, autenticar usuários, confirmar email, recuperar senha, validar WhatsApp, processar pedidos, identificar o quiosque responsável, enviar comunicações operacionais, gerar relatórios, prestar suporte, prevenir fraudes, garantir segurança, realizar cobranças e cumprir obrigações legais.",
  },
  {
    title: "7. LGPD e bases legais",
    body:
      "O tratamento de dados pessoais observa a Lei Geral de Proteção de Dados. As bases legais podem incluir execução de contrato, cumprimento de obrigação legal ou regulatória, legítimo interesse, consentimento quando necessário, exercício regular de direitos e proteção do crédito quando aplicável.",
  },
  {
    title: "8. Compartilhamento de dados",
    body:
      "Dados podem ser compartilhados somente quando necessário para operar a plataforma, incluindo provedores de hospedagem, banco de dados, autenticação, email, WhatsApp Business Platform, gateways de pagamento, ferramentas de monitoramento e autoridades públicas quando exigido por lei. O SandExpress não vende dados pessoais.",
  },
  {
    title: "9. WhatsApp e comunicações",
    body:
      "O SandExpress pode utilizar WhatsApp para validação, confirmação de pedidos e comunicações operacionais. Ao iniciar conversa pelo WhatsApp, o usuário também fica sujeito às políticas da Meta/WhatsApp. Comunicações de segurança, suporte, operação e manutenção podem ser enviadas independentemente de preferências de marketing.",
  },
  {
    title: "10. Cookies e dados técnicos",
    body:
      "A plataforma pode utilizar cookies necessários e tecnologias semelhantes para manter sessão, lembrar preferências, melhorar segurança, medir desempenho, identificar erros e prevenir fraudes. Também podem ser registrados IP, navegador, sistema operacional, dispositivo, logs de acesso, data e hora e identificadores de sessão.",
  },
  {
    title: "11. Segurança da informação",
    body:
      "O SandExpress adota medidas técnicas e administrativas como HTTPS/TLS, autenticação, controle de acesso, segregação por tenant, Row Level Security no banco, logs de auditoria, tokens temporários, expiração de links sensíveis, limitação de tentativas, armazenamento seguro de variáveis secretas, backups e monitoramento.",
  },
  {
    title: "12. Retenção, exclusão e anonimização",
    body:
      "Os dados serão mantidos pelo tempo necessário para cumprir as finalidades informadas, obrigações legais, auditoria, prevenção a fraude, defesa em processos, obrigações fiscais ou contratuais. Quando não forem mais necessários, poderão ser eliminados ou anonimizados conforme a legislação aplicável.",
  },
  {
    title: "13. Direitos do titular",
    body:
      "Nos termos da LGPD, o titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade quando aplicável, informação sobre compartilhamento, revogação de consentimento e oposição ao tratamento quando aplicável.",
  },
  {
    title: "14. Planos, pagamentos, suspensão e cancelamento",
    body:
      "O uso da plataforma pode estar sujeito a planos gratuitos, promocionais ou pagos. Valores, periodicidade, limites e funcionalidades são apresentados na contratação e podem ser atualizados conforme política comercial. Inadimplência, fraude, violação destes termos ou risco de segurança podem causar suspensão, bloqueio ou cancelamento da conta.",
  },
  {
    title: "15. Aceite eletrônico",
    body:
      "Ao marcar a opção de aceite no cadastro, o usuário declara que leu, compreendeu e aceitou os Termos de Uso e a Política de Privacidade do SandExpress. O sistema registra eletronicamente o aceite com versão, data e hora, identificação do tenant/quiosque, IP, User-Agent, dados cadastrais relevantes e hash de integridade do documento aceito.",
  },
  {
    title: "16. Alterações dos termos",
    body:
      "Estes termos e a política de privacidade podem ser atualizados para refletir mudanças legais, melhorias de segurança, novas funcionalidades, ajustes comerciais ou evolução da plataforma. Alterações relevantes podem exigir novo aceite antes da continuidade de uso.",
  },
  {
    title: "17. Contato",
    body:
      "Para dúvidas sobre privacidade, proteção de dados, suporte ou uso da plataforma, utilize o canal oficial de atendimento do SandExpress: contato@sandexpress.com.br.",
  },
];

export default function TermsOfUsePage() {
  return (
    <main className="landing-shell min-h-screen bg-[#201411] px-4 py-10 text-[#fff8f6] sm:px-6">
      <article className="mx-auto max-w-4xl rounded-3xl border border-[#7a2b00] bg-[#451704]/92 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:p-10">
        <Link href="/" className="text-sm font-black text-[#ff8a2b] hover:text-[#ffb168]">
          Voltar para o cadastro
        </Link>

        <header className="mt-6">
          <p className="text-sm font-black uppercase text-[#ff8a2b]">Documento único de aceite</p>
          <h1 className="mt-2 text-3xl font-display font-bold sm:text-4xl">{TERMS_DOCUMENT_TITLE}</h1>
          <p className="mt-3 text-sm font-bold text-[#ffcfb1]">Versão {TERMS_VERSION}</p>
          <p className="mt-1 break-all text-xs text-[#d8a892]">Hash SHA-256: {TERMS_DOCUMENT_HASH}</p>
        </header>

        <div className="mt-8 rounded-2xl border border-[#9b3a05] bg-[#2b160f] p-5">
          <h2 className="text-lg font-bold text-[#fff8f6]">Texto do aceite</h2>
          <p className="mt-2 text-sm leading-7 text-[#ffd7c4]">{TERMS_CONSENT_TEXT}</p>
        </div>

        <div className="mt-8 space-y-6 text-sm leading-7 text-[#ffd7c4] sm:text-base">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-[#fff8f6]">{section.title}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
