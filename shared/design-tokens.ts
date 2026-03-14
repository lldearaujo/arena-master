export const tokens = {
  color: {
    // Arena Master design system
    // Paleta principal inspirada no material de identidade visual:
    // - Arena Gold (Primary CTA)
    // - Deep Blue (Superfícies principais)
    // - Paper Off‑White (Background)
    // - Alert Red (Estados de alerta)
    primary: "#B89E5D", // Arena Gold
    primaryDark: "#8C7440",
    bgBody: "#F4F1E8", // Paper Off‑White
    bgCard: "#1B303F", // Deep Blue
    textOnPrimary: "#FFFFFF",
    textPrimary: "#111827",
    textMuted: "#6b7280",
    borderSubtle: "#E0D6C4",
    borderStrong: "#13202B",
    kids: "#FACC15",
    success: "#22C55E",
    error: "#D9534F", // Alert Red
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 999,
  },
  text: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    "2xl": 28,
  },
} as const;

