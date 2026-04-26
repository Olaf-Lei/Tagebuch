import { useContext } from 'react';
import { LanguageContext } from '../contexts/LanguageContext';
import { de } from './de';
import { en } from './en';
export type { Strings } from './de';

export function useT() {
  const { language } = useContext(LanguageContext);
  return language === 'en' ? en : de;
}
