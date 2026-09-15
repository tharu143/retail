import { useState, useEffect } from 'react';

/**
 * Custom hook for managing the Legacy POS Theme (Green/Blue).
 * Synchronizes with localStorage and updates CSS variables on the document root.
 */
export const useLegacyTheme = () => {
    // Current theme choice: 'green' or 'blue'
    const [legacySubTheme, setLegacySubTheme] = useState(
        localStorage.getItem('legacySubTheme') || 'green'
    );

    const isGreen = legacySubTheme === 'green';
    
    // Core color tokens derived from the theme
    const themeColor = isGreen ? '#10b981' : '#0082f6';       // --so-primary
    const themeColorHover = isGreen ? '#059669' : '#0070f3';  // --so-primary-hover
    const themeLight = isGreen ? '#f0fdf4' : '#ebf4fe';       // --so-primary-light
    
    // Additional report/ui tokens
    const themeHeaderBg = isGreen ? '#f2fdf9' : '#ebf4fe';
    const themeHeaderText = isGreen ? '#0d9488' : '#0082f6';

    useEffect(() => {
        // Persist theme choice
        localStorage.setItem('legacySubTheme', legacySubTheme);

        // Update CSS variables for global use
        document.documentElement.style.setProperty('--so-primary', themeColor);
        document.documentElement.style.setProperty('--so-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--so-primary-light', themeLight);
        
        // Also update the Purchase Order specific variables if they are used
        document.documentElement.style.setProperty('--po-primary', themeColor);
        document.documentElement.style.setProperty('--po-primary-hover', themeColorHover);
        document.documentElement.style.setProperty('--po-primary-light', themeLight);
    }, [legacySubTheme, themeColor, themeColorHover, themeLight]);

    const toggleTheme = () => {
        setLegacySubTheme(prev => (prev === 'green' ? 'blue' : 'green'));
    };

    return {
        legacySubTheme,
        setLegacySubTheme,
        isGreen,
        themeColor,
        themeColorHover,
        themeLight,
        themeHeaderBg,
        themeHeaderText,
        toggleTheme
    };
};
