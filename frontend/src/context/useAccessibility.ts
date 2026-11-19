import { createContext, useContext } from 'react';

export type ThemeMode = 'light' | 'dark';

export interface AccessibilityContextValue {
    theme: ThemeMode;
    isDark: boolean;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
}

export const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

export function useAccessibility(): AccessibilityContextValue {
    const context = useContext(AccessibilityContext);

    if (!context) {
        throw new Error('useAccessibility debe utilizarse dentro de AccessibilityProvider');
    }

    return context;
}
