import { useEffect, type ReactNode } from "react";

import { useThemeStore } from "../../lib/theme-store";

export function AppProviders({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = typeof window !== "undefined" && "matchMedia" in window ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const systemPrefersDark = mediaQuery?.matches ?? false;
    const resolvedTheme = theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [theme]);

  return <>{children}</>;
}
