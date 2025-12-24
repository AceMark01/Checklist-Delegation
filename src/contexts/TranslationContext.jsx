import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from '../utils/translations'

const TranslationContext = createContext()

export const useTranslation = () => {
  const context = useContext(TranslationContext)
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider')
  }
  return context
}

export const TranslationProvider = ({ children }) => {
  const [language, setLanguageState] = useState(() => {
    // Initialize from localStorage or default to 'en'
    const savedLanguage = localStorage.getItem('appLanguage')
    return savedLanguage || 'en'
  })

  // Update localStorage whenever language changes
  useEffect(() => {
    localStorage.setItem('appLanguage', language)
  }, [language])

  const setLanguage = (lang) => {
    if (lang === 'en' || lang === 'hi') {
      setLanguageState(lang)
    }
  }

  const toggleLanguage = () => {
    setLanguageState(prev => prev === 'en' ? 'hi' : 'en')
  }

  // Translation function
  const t = (key) => {
    const keys = key.split('.')
    let value = translations[language]
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        return key // Return key if translation not found
      }
    }
    
    return value || key
  }

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    t
  }

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  )
}
