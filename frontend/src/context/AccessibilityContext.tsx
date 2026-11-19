import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityContext, type AccessibilityContextValue, type ThemeMode } from './useAccessibility';

const ACCESSIBILITY_THEME_KEY = 'vilas-tema-accesibilidad';

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
