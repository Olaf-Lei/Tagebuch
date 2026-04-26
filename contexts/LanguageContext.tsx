import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as Localization from 'expo-localization';

export type Language = 'de' | 'en';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'de',
  setLanguage: () => {},
});

const KEY = 'app_language';

function detectSystemLanguage(): Language {
  try {
    const code = Localization.getLocales()[0]?.languageCode ?? 'de';
    return code.startsWith('en') ? 'en' : 'de';
  } catch {
    return 'de';
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('de');

  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((val) => {
      if (val === 'de' || val === 'en') setLanguageState(val);
      else setLanguageState(detectSystemLanguage());
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    SecureStore.setItemAsync(KEY, lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
