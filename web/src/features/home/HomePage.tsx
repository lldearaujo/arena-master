import { useState } from "react";
import { Link } from "react-router-dom";

import { tokens } from "../../ui/tokens";
import "./HomePage.css";
import arenaMasterLogo from "../../assets/arena-master-logo.png";
import arenaMasterAppLogo from "../../assets/arena-master-app.png";

const CONTAINER_MAX = 1200;
const SECTION_PY = 96;
const NAV_HEIGHT = 80;

const containerStyle: React.CSSProperties = {
  maxWidth: CONTAINER_MAX,
  margin: "0 auto",
  padding: `0 ${tokens.space.xl}px`,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: tokens.color.primary,
  marginBottom: tokens.space.sm,
};

const btnPrimaryStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 28px",
  backgroundColor: tokens.color.primary,
  color: tokens.color.textOnPrimary,
  borderRadius: tokens.radius.md,
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 600,
  transition: "background-color 0.2s ease, transform 0.15s ease",
};

function IconCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconCheckIn() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function IconBelt() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="1" />
      <path d="M12 7v10" />
      <path d="M7 12h10" />
    </svg>
  );
}
function IconMoney() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}
function IconMural() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

const featureIcons: Record<string, React.ReactNode> = {
  calendar: <IconCalendar />,
  users: <IconUsers />,
  checkin: <IconCheckIn />,
  belt: <IconBelt />,
  money: <IconMoney />,
  mural: <IconMural />,
};

function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav
      className={menuOpen ? "home-nav home-nav-open" : "home-nav"}
      style={{
        minHeight: NAV_HEIGHT,
        borderBottom: `1px solid ${tokens.color.borderSubtle}`,
        backgroundColor: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        className="home-container home-nav-inner"
        style={{
          ...containerStyle,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link to="/" className="home-nav-logo" style={{ display: "flex", alignItems: "center", textDecoration: "none" }} onClick={closeMenu}>
          <img src={arenaMasterAppLogo} alt="Arena Master" style={{ height: 56, width: "auto", display: "block" }} />
        </Link>

        <button
          type="button"
          className="home-nav-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={menuOpen}
          style={{
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: tokens.color.textPrimary,
          }}
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        <div className="home-nav-links" style={{ display: "flex", alignItems: "center", gap: tokens.space.xl }}>
          <a href="#recursos" onClick={closeMenu} style={{ color: tokens.color.textPrimary, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            Recursos
          </a>
          <a href="#precos" onClick={closeMenu} style={{ color: tokens.color.textPrimary, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            Preços
          </a>
          <a href="#depoimentos" onClick={closeMenu} style={{ color: tokens.color.textPrimary, textDecoration: "none", fontSize: 14, fontWeight: 500 }}>
            Depoimentos
          </a>
          <Link
            to="/login"
            style={{
              ...btnPrimaryStyle,
              padding: "10px 22px",
              fontSize: 14,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = tokens.color.primaryDark;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = tokens.color.primary;
            }}
            onClick={closeMenu}
          >
            Entrar
          </Link>
        </div>
      </div>

      <div className="home-nav-dropdown">
        <a href="#recursos" onClick={closeMenu}>Recursos</a>
        <a href="#precos" onClick={closeMenu}>Preços</a>
        <a href="#depoimentos" onClick={closeMenu}>Depoimentos</a>
        <Link to="/login" onClick={closeMenu}>Entrar</Link>
      </div>
    </nav>
  );
}

const trustBadges = ["Sem cartão de crédito para testar", "Cancele quando quiser", "Suporte por e-mail"];

function Hero() {
  return (
    <header
      className="home-hero"
      style={{
        background: `linear-gradient(180deg, ${tokens.color.bgCard} 0%, #152a38 100%)`,
        color: tokens.color.textOnPrimary,
        padding: `${SECTION_PY + 32}px ${tokens.space.xl}px ${SECTION_PY}px`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 60% at 70% 30%, ${tokens.color.primary}15 0%, transparent 55%)`,
          pointerEvents: "none",
        }}
      />
      <div className="home-container" style={{ ...containerStyle, position: "relative", textAlign: "center" }}>
        <div className="home-hero-logo" style={{ marginBottom: tokens.space.xl * 1.5 }}>
          <img
            src={arenaMasterLogo}
            alt="Arena Master"
            style={{
              height: "clamp(100px, 18vw, 160px)",
              width: "auto",
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>
        <h1
          style={{
            fontSize: "clamp(36px, 5vw, 52px)",
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
            marginBottom: tokens.space.lg,
            maxWidth: 720,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          O software de gestão para seu dojo e artes marciais
        </h1>
        <p
          className="home-hero-sub"
          style={{
            fontSize: 18,
            lineHeight: 1.6,
            opacity: 0.92,
            maxWidth: 560,
            margin: "0 auto",
            marginBottom: tokens.space.xl * 1.5,
          }}
        >
          Presença, turmas, faixas e cobrança em um só lugar. Painel para o professor e app para os alunos. Simples e direto.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={btnPrimaryStyle}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = tokens.color.primaryDark;
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = tokens.color.primary;
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Quero assinar o plano
        </a>
        <div
          className="home-trust-badges"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: tokens.space.lg,
            marginTop: tokens.space.xl * 1.5,
          }}
        >
          {trustBadges.map((badge) => (
            <span
              key={badge}
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.85)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ color: tokens.color.primary }}>✓</span> {badge}
            </span>
          ))}
        </div>
        <div
          className="home-store-badges"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: tokens.space.lg,
            marginTop: tokens.space.xl * 2,
          }}
        >
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", marginRight: tokens.space.sm }}>
            Baixe o app:
          </span>
          <a
            href="https://apps.apple.com/app/arena-master/id000000000"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Baixar na App Store"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 40,
              paddingLeft: 12,
              paddingRight: 16,
              backgroundColor: "#000",
              borderRadius: 6,
              textDecoration: "none",
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ marginRight: 6 }}>
              <path
                d="M18.5 13.2c.1-2.2.9-4 2.4-5.3-1.3-2.4-3.3-3.6-5.4-3.7-2.3-.2-4.3 1.3-5.4 1.3-1.1 0-2.8-1.2-4.7-1.1-2.4.1-4.6 1.4-5.8 3.6-2.5 4.3-.6 10.7 1.8 14.2 1.2 1.6 2.6 3.4 4.5 3.3 1.8-.1 2.5-1.1 4.7-1.1 2.2 0 2.8 1.1 4.7 1.1 1.9 0 3.1-1.5 4.3-3.2 1.3-2 1.9-3.9 1.9-4 .1-.1-10-3.9-9.9-15.6zm-5.8-9.1c1.4-1.7 2.3-4 2.1-6.3-2 .1-4.4 1.3-5.9 3-1.3 1.5-2.4 3.9-2.1 6.2 2.2.2 4.3-1.2 5.9-2.9z"
                fill="#fff"
              />
            </svg>
            <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: "-0.02em" }}>
              App Store
            </span>
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.arenamaster.app"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Disponível no Google Play"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 40,
              paddingLeft: 10,
              paddingRight: 14,
              backgroundColor: "#000",
              borderRadius: 6,
              textDecoration: "none",
              transition: "opacity 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" style={{ marginRight: 6 }}>
              <path
                d="M3.5 2.2v21.6l10.5-5.8V8L3.5 2.2zm11 5.8v9.6l8.2-4.5V5.5l-3.2 1.8-5 2.7zm-1.2-2l5-2.8 4.2 2.4-5 2.7-4.2-2.3zm0 11v-2.2l4.2-2.3 2.2 1.2-6.4 3.3z"
                fill="#fff"
              />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 8 }}>Disponível no</span>
              <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Google Play</span>
            </div>
          </a>
        </div>
      </div>
    </header>
  );
}

const featuresGrid = [
  {
    icon: "calendar",
    title: "Turmas e horários",
    description: "Cadastre turmas, dias da semana e capacidade. Controle vagas e matrículas em poucos cliques.",
  },
  {
    icon: "users",
    title: "Alunos e responsáveis",
    description: "Cadastro completo com vínculo de responsáveis para turmas infantis. Tudo organizado por dojo.",
  },
  {
    icon: "checkin",
    title: "Check-in e presenças",
    description: "Registro de presença no painel ou pelo app. Alunos e responsáveis fazem check-in; você vê em tempo real.",
  },
  {
    icon: "belt",
    title: "Faixas e graduações",
    description: "Defina as faixas do dojo com graus e dans. Acompanhe a evolução de cada aluno e exiba no perfil.",
  },
  {
    icon: "money",
    title: "Financeiro",
    description: "Controle cobranças, pagamentos e comprovantes. Menos planilha, mais previsibilidade.",
  },
  {
    icon: "mural",
    title: "Mural de avisos",
    description: "Comunique-se com os alunos por avisos no app. Avisos importantes sempre à mão.",
  },
];

function FeaturesSection() {
  return (
    <section
      id="recursos"
      className="home-section"
      style={{
        padding: `${SECTION_PY}px 0`,
        backgroundColor: tokens.color.bgBody,
      }}
    >
      <div className="home-container" style={containerStyle}>
        <p style={{ ...sectionLabelStyle, color: tokens.color.primary, textAlign: "center" }}>Recursos</p>
        <h2
          style={{
            fontSize: "clamp(26px, 3.5vw, 34px)",
            fontWeight: 700,
            color: tokens.color.textPrimary,
            marginBottom: 12,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          Tudo que você precisa para crescer
        </h2>
        <p
          style={{
            fontSize: 16,
            color: tokens.color.textMuted,
            marginBottom: tokens.space.xl * 1.5,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Ferramentas pensadas para dojos e academias de artes marciais. Painel web e app em um único plano.
        </p>
        <div
          className="home-features-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: tokens.space.xl,
          }}
        >
          {featuresGrid.map((item) => (
            <div
              key={item.title}
              style={{
                padding: tokens.space.xl * 1.25,
                backgroundColor: "#fff",
                borderRadius: tokens.radius.lg,
                border: `1px solid ${tokens.color.borderSubtle}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                transition: "box-shadow 0.2s ease, border-color 0.2s ease",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.08)";
                e.currentTarget.style.borderColor = tokens.color.primary + "40";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                e.currentTarget.style.borderColor = tokens.color.borderSubtle;
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: tokens.radius.md,
                  backgroundColor: `${tokens.color.primary}18`,
                  color: tokens.color.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: tokens.space.md,
                }}
              >
                {featureIcons[item.icon]}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: tokens.color.textPrimary,
                  marginBottom: 8,
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  color: tokens.color.textMuted,
                  lineHeight: 1.55,
                  margin: 0,
                }}
              >
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const planFeatures = [
  "Painel web completo para o professor",
  "App para alunos e responsáveis (check-in)",
  "Turmas, horários e capacidade ilimitados",
  "Sistema de faixas e graduações",
  "Controle financeiro e comprovantes",
  "Mural de avisos",
  "Suporte por e-mail",
];

const pricingBadges = ["Sem compromisso", "Cancele quando quiser", "Cobrança mensal"];

function PricingSection() {
  return (
    <section
      id="precos"
      className="home-section"
      style={{
        padding: `${SECTION_PY}px 0`,
        backgroundColor: "#fff",
        borderTop: `1px solid ${tokens.color.borderSubtle}`,
      }}
    >
      <div className="home-container" style={containerStyle}>
        <p style={{ ...sectionLabelStyle, color: tokens.color.primary, textAlign: "center" }}>Preços</p>
        <h2
          style={{
            fontSize: "clamp(26px, 3.5vw, 34px)",
            fontWeight: 700,
            color: tokens.color.textPrimary,
            marginBottom: 12,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          Preço simples e transparente
        </h2>
        <p
          style={{
            fontSize: 16,
            color: tokens.color.textMuted,
            marginBottom: tokens.space.sm,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Um plano com tudo incluso. Sem taxas por aluno.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: tokens.space.sm,
            marginBottom: tokens.space.xl * 1.5,
          }}
        >
          {pricingBadges.map((b) => (
            <span
              key={b}
              style={{
                fontSize: 12,
                color: tokens.color.textMuted,
                padding: "6px 12px",
                backgroundColor: tokens.color.bgBody,
                borderRadius: tokens.radius.full,
              }}
            >
              {b}
            </span>
          ))}
        </div>
        <div
          className="home-pricing-card"
          style={{
            maxWidth: 400,
            margin: "0 auto",
            padding: tokens.space.xl * 1.5,
            boxSizing: "border-box",
            backgroundColor: tokens.color.bgCard,
            borderRadius: tokens.radius.lg,
            border: `2px solid ${tokens.color.primary}`,
            color: tokens.color.textOnPrimary,
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.9,
              marginBottom: tokens.space.sm,
            }}
          >
            Assinatura mensal
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: tokens.space.lg }}>
            <span className="home-pricing-price" style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>R$ 70</span>
            <span style={{ fontSize: 16, opacity: 0.9 }}>/mês</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              fontSize: 14,
              lineHeight: 1.85,
              opacity: 0.95,
              marginBottom: tokens.space.xl,
            }}
          >
            {planFeatures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...btnPrimaryStyle,
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              backgroundColor: tokens.color.primary,
              color: tokens.color.textOnPrimary,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = tokens.color.primaryDark;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = tokens.color.primary;
            }}
          >
            Quero assinar
          </a>
        </div>
      </div>
    </section>
  );
}

const WHATSAPP_NUMBER = "5583994068978";
const WHATSAPP_MSG = "Olá! Tenho interesse em assinar o plano Arena Master.";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MSG)}`;

const depoimentos = [
  {
    texto: "A organização das turmas e o check-in pelo app mudaram a rotina do dojo. Menos tempo em planilha e mais tempo no tatame.",
    nome: "Carlos M.",
    cargo: "Professor de Jiu-Jitsu",
  },
  {
    texto: "Controle de presença e financeiro em um só lugar. Meus alunos adoram fazer check-in pelo celular e eu tenho tudo na palma da mão.",
    nome: "Fernanda A.",
    cargo: "Proprietária de academia",
  },
  {
    texto: "Sistema de faixas e graduações alinhado à realidade do dojo. Simples de usar e o suporte responde na hora.",
    nome: "Rafael C.",
    cargo: "Instrutor e gestor",
  },
];

function DepoimentosSection() {
  return (
    <section
      id="depoimentos"
      className="home-section"
      style={{
        padding: `${SECTION_PY}px 0`,
        backgroundColor: tokens.color.bgBody,
        borderTop: `1px solid ${tokens.color.borderSubtle}`,
      }}
    >
      <div className="home-container" style={containerStyle}>
        <p style={{ ...sectionLabelStyle, color: tokens.color.primary, textAlign: "center" }}>Depoimentos</p>
        <h2
          style={{
            fontSize: "clamp(26px, 3.5vw, 34px)",
            fontWeight: 700,
            color: tokens.color.textPrimary,
            marginBottom: 12,
            letterSpacing: "-0.02em",
            textAlign: "center",
          }}
        >
          Quem usa recomenda
        </h2>
        <p
          style={{
            fontSize: 16,
            color: tokens.color.textMuted,
            marginBottom: tokens.space.xl * 1.5,
            textAlign: "center",
            lineHeight: 1.5,
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Professores e gestores de dojos que já simplificaram o dia a dia com o Arena Master.
        </p>
        <div
          className="home-depoimentos-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: tokens.space.xl,
          }}
        >
          {depoimentos.map((d) => (
            <div
              key={d.nome}
              style={{
                padding: tokens.space.xl * 1.25,
                backgroundColor: "#fff",
                borderRadius: tokens.radius.lg,
                border: `1px solid ${tokens.color.borderSubtle}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
            >
              <p
                style={{
                  fontSize: 15,
                  color: tokens.color.textPrimary,
                  lineHeight: 1.6,
                  marginBottom: tokens.space.lg,
                  fontStyle: "italic",
                }}
              >
                "{d.texto}"
              </p>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: tokens.color.textPrimary }}>{d.nome}</div>
                <div style={{ fontSize: 13, color: tokens.color.textMuted }}>{d.cargo}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section
      className="home-cta-section"
      style={{
        padding: `${SECTION_PY}px ${tokens.space.xl}px`,
        background: `linear-gradient(180deg, ${tokens.color.borderStrong} 0%, ${tokens.color.bgCard} 100%)`,
        color: tokens.color.textOnPrimary,
        textAlign: "center",
      }}
    >
      <div className="home-container" style={containerStyle}>
        <h2
          style={{
            fontSize: 24,
            fontWeight: 600,
            marginBottom: tokens.space.sm,
          }}
        >
          Pronto para simplificar a gestão do seu dojo?
        </h2>
        <p
          style={{
            fontSize: 16,
            opacity: 0.9,
            marginBottom: tokens.space.lg,
          }}
        >
          Fale conosco e assine o plano por R$ 70/mês. Sem compromisso.
        </p>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={btnPrimaryStyle}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = tokens.color.primaryDark;
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = tokens.color.primary;
          }}
        >
          Quero assinar o plano
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="home-footer"
      style={{
        padding: `${tokens.space.xl * 1.5}px ${tokens.space.xl}px`,
        backgroundColor: tokens.color.borderStrong,
        color: tokens.color.textOnPrimary,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
      }}
    >
      <div
        className="home-container home-footer-inner"
        style={{
          ...containerStyle,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space.lg,
        }}
      >
        <Link to="/" className="home-footer-logo" style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit" }}>
          <img src={arenaMasterLogo} alt="Arena Master" style={{ height: 44, width: "auto", opacity: 0.95 }} />
        </Link>
        <div className="home-footer-links" style={{ display: "flex", alignItems: "center", gap: tokens.space.xl, flexWrap: "wrap" }}>
          <a href="#recursos" style={{ color: "inherit", textDecoration: "none", fontSize: 13, opacity: 0.85 }}>
            Recursos
          </a>
          <a href="#precos" style={{ color: "inherit", textDecoration: "none", fontSize: 13, opacity: 0.85 }}>
            Preços
          </a>
          <a href="#depoimentos" style={{ color: "inherit", textDecoration: "none", fontSize: 13, opacity: 0.85 }}>
            Depoimentos
          </a>
          <Link
            to="/politica-de-privacidade"
            style={{
              color: "inherit",
              textDecoration: "none",
              fontSize: 13,
              opacity: 0.85,
            }}
          >
            Política de privacidade
          </Link>
          <span style={{ fontSize: 13, opacity: 0.7 }}>© {new Date().getFullYear()} Arena Master</span>
        </div>
      </div>
    </footer>
  );
}

export function HomePage() {
  return (
    <div
      className="home-page"
      style={{
        fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <NavBar />
      <Hero />
      <main style={{ flex: 1 }}>
        <FeaturesSection />
        <PricingSection />
        <DepoimentosSection />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
