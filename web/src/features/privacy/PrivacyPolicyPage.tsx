import { tokens } from "../../ui/tokens";
import arenaMasterLogo from "../../assets/arena-master-logo.png";

export function PrivacyPolicyPage() {
  const lastUpdated = "18 de março de 2026";

  const cardStyle = {
    padding: tokens.space.xl,
    backgroundColor: "white",
    borderRadius: tokens.radius.lg,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    border: `1px solid ${tokens.color.borderSubtle}`,
  };

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        fontFamily: "system-ui",
        backgroundColor: tokens.color.bgBody,
        minHeight: "100vh",
        padding: tokens.space.xl,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: tokens.space.xl }}>
        <img
          src={arenaMasterLogo}
          alt="Arena Master"
          style={{ width: "100%", maxWidth: 220, height: "auto", objectFit: "contain" }}
        />
      </div>
      <div style={cardStyle}>
        <h1 style={{ fontSize: tokens.text["2xl"], marginBottom: tokens.space.lg, fontWeight: 600 }}>
          Política de Privacidade
        </h1>

        <p style={{ color: tokens.color.textMuted, marginBottom: tokens.space.xl }}>
          Versão atualizada em {lastUpdated}
        </p>

        <section style={{ marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
            1. Objetivo
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: tokens.color.textPrimary }}>
            Esta Política de Privacidade explica como a Arena Master coleta, usa e protege informações quando
            você utiliza nosso sistema para gerenciar dojos, alunos, turmas e atividades.
          </p>
        </section>

        <section style={{ marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
            2. Quais dados coletamos
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, color: tokens.color.textPrimary }}>
            <li>
              <strong>Dados de conta:</strong> e-mail, autenticação e permissões (papel/role).
            </li>
            <li>
              <strong>Dados do dojo:</strong> informações cadastradas pelo responsável, como nome, slug e
              logotipo (quando fornecido).
            </li>
            <li>
              <strong>Dados de alunos e turmas:</strong> informações necessárias para registro e organização.
            </li>
            <li>
              <strong>Dados de uso:</strong> registros técnicos de acesso ao serviço (ex.: logs de requisição),
              para segurança e funcionamento.
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
            3. Para que usamos os dados
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, color: tokens.color.textPrimary }}>
            <li>Autenticar e autorizar o acesso às funcionalidades do sistema.</li>
            <li>Permitir a gestão de alunos, turmas e check-ins.</li>
            <li>Organizar conteúdos e configurações do seu dojo.</li>
            <li>Gerenciar informações relacionadas ao financeiro (quando aplicável).</li>
          </ul>
        </section>

        <section style={{ marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
            4. Compartilhamento de dados
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: tokens.color.textPrimary }}>
            Não vendemos suas informações. Podemos compartilhá-las com provedores que nos ajudam a operar o
            sistema (por exemplo, serviços de hospedagem e infraestrutura), estritamente para viabilizar o
            funcionamento do serviço.
          </p>
        </section>

        <section style={{ marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
            5. Segurança
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: tokens.color.textPrimary }}>
            Utilizamos medidas técnicas e organizacionais para proteger dados contra acesso não autorizado,
            alteração indevida, divulgação ou destruição. Ainda assim, nenhum método de transmissão ou armazenamento
            é totalmente seguro.
          </p>
        </section>

        <section style={{ marginBottom: tokens.space.xl }}>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
            6. Seus direitos
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: tokens.color.textPrimary }}>
            Você pode solicitar informações, correção ou exclusão de dados relacionados à sua conta, de acordo
            com a legislação aplicável. Para isso, entre em contato com o suporte.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: tokens.text.lg, marginBottom: tokens.space.md, fontWeight: 600 }}>
            7. Contato
          </h2>
          <p style={{ lineHeight: 1.7, margin: 0, color: tokens.color.textPrimary }}>
            Se precisar de ajuda com esta Política de Privacidade, contate o suporte do sistema.
          </p>
          <p style={{ color: tokens.color.textMuted, marginTop: tokens.space.sm, marginBottom: 0, lineHeight: 1.6 }}>
            Observação: revise e substitua os textos pelo conteúdo jurídico adotado por você (por exemplo, e-mail
            de contato e detalhes específicos da operação).
          </p>
        </section>
      </div>
    </div>
  );
}

