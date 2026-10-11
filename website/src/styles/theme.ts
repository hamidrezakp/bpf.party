export const darkTheme = {
  bgPrimary: "#070b14",
  bgSecondary: "rgba(255, 255, 255, 0.05)",
  codeBg: "rgba(13, 18, 31, 0.85)",
  codeFg: "#fff",

  textPrimary: "#dfe6f1",
  textHighlight: "#f5f8ff",
  textSecondary: "#8a93a8",
  accent: "#7aa2ff",
  accent2: "#9d7bff",
  alertBg: "rgba(244, 67, 54, 0.1)",
  border: "rgba(255, 255, 255, 0.08)",
  navbarBg: "rgba(8, 12, 22, 0.6)",
  navbarBorder: "rgba(255, 255, 255, 0.08)",
} as const;

export const yellowTheme = {
  bgPrimary: "#fdf6e3",
  bgSecondary: "color-mix(in hsl, var(--color-bg-primary), black 5%)",
  codeBg: "color-mix(in hsl, var(--color-bg-primary), red 25%)",
  codeFg: "black",
  textPrimary: "#575279",
  textHighlight: "#286983",

  textSecondary: "#888888",
  accent: "#d7827e",
  alertBg: "#2e1e1e",
  border: "#2a2e38",
  navbarBg:
    "color-mix(in hsl, var(--color-bg-primary), var(--color-accent) 30%)",
  navbarBorder: "hsl(224, 10%, 10%)",
} as const;

export const roseTheme = {
  bgPrimary: "#faf4ed",
  bgSecondary: "color-mix(in hsl, var(--color-bg-primary), black 5%)",
  codeBg: "color-mix(in hsl, var(--color-bg-primary), red 25%)",
  codeFg: "black",
  textPrimary: "#575279",
  textHighlight: "#286983",

  textSecondary: "#888888",
  accent: "#d7827e",
  alertBg: "#2e1e1e",
  border: "#2a2e38",
  navbarBg:
    "color-mix(in hsl, var(--color-bg-primary), var(--color-accent) 30%)",
  navbarBorder: "hsl(224, 10%, 10%)",
} as const;

export const lightTheme = darkTheme;
