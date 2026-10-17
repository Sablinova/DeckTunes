import { useState } from 'react'
import languages from '../lib/translations'

function getCurrentLanguage(): keyof typeof languages {
  const steamLang = window.LocalizationManager.m_rgLocalesToUse[0]
  const lang = steamLang.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase()
  ) as keyof typeof languages
  return languages[lang] ? lang : 'en'
}

function useTranslations() {
  const [lang] = useState(getCurrentLanguage())
  return function (
    key: keyof (typeof languages)['en'],
    replacements: { [key: string]: string } = {}
  ): string {
    let result
    //
    const localized = languages[lang] as Partial<(typeof languages)['en']>
    if (localized[key]?.length) {
      result = localized[key]
    } else if (languages.en?.[key]?.length) {
      result = languages.en?.[key]
    } else {
      result = key
    }
    // Based on this generic replacement solution: https://stackoverflow.com/a/61634647
    return result.replace(
      /{\w+}/g,
      (placeholder: string) =>
        replacements[placeholder.substring(1, placeholder.length - 1)] ||
        placeholder
    )
  }
}

export default useTranslations
