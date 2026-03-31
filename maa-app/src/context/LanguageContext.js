import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    const [language, setLanguageState] = useState('hi');

    const setLanguage = useCallback((nextLanguage) => {
        setLanguageState(nextLanguage === 'en' ? 'en' : 'hi');
    }, []);

    const value = useMemo(
        () => ({
            language,
            setLanguage,
            isHindi: language !== 'en',
        }),
        [language, setLanguage]
    );

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}
