import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

interface AccessibilityContextValue {
    theme: ThemeMode;
    isDark: boolean;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
}

const ACCESSIBILITY_THEME_KEY = 'vilas-tema-accesibilidad';

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

function getInitialTheme(): ThemeMode {
    if (typeof window === 'undefined') return 'light';

    return window.localStorage.getItem(ACCESSIBILITY_THEME_KEY) === 'dark' ? 'dark' : 'light';
}

export const AccessibilityProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
    const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        window.localStorage.setItem(ACCESSIBILITY_THEME_KEY, theme);
    }, [theme]);

    const value = useMemo<AccessibilityContextValue>(() => ({
        theme,
        isDark: theme === 'dark',
        setTheme: setThemeState,
        toggleTheme: () => setThemeState((current) => current === 'light' ? 'dark' : 'light'),
    }), [theme]);

    return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
};

export function useAccessibility(): AccessibilityContextValue {
    const context = useContext(AccessibilityContext);

    if (!context) {
        throw new Error('useAccessibility debe utilizarse dentro de AccessibilityProvider');
    }

    return context;
}
