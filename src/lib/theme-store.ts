import { create } from "zustand";

import type { ThemeMode } from "../types/app";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "system",
  setTheme: (theme) => set({ theme }),
}));
