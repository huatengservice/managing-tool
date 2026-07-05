"use client";

/**
 * Interface language toggle (spec §11): switches the app's own chrome
 * between Traditional Chinese and English. Business data (customer names,
 * addresses, descriptions, suppliers) is NEVER translated — components
 * render those fields verbatim, so there is no code path that could.
 *
 * Every label is authored inline as t("中文", "English"), which guarantees
 * a selected language has no leftover fragments from the other.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "zh" | "en";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: "zh",
  setLang: () => {},
});

const COOKIE = "app-lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("zh");

  useEffect(() => {
    const m = document.cookie.match(new RegExp(`${COOKIE}=(zh|en)`));
    if (m) setLangState(m[1] as Lang);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `${COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
  }, []);

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** t("中文", "English") — returns the label in the active interface language. */
export function useT() {
  const { lang } = useContext(LangContext);
  return useCallback((zh: string, en: string) => (lang === "en" ? en : zh), [lang]);
}

export function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex bg-slate-100 rounded-full p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLang("zh")}
        className={`px-2.5 py-1 rounded-full ${lang === "zh" ? "bg-slate-900 text-white" : "text-slate-500"}`}
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 rounded-full ${lang === "en" ? "bg-slate-900 text-white" : "text-slate-500"}`}
      >
        EN
      </button>
    </div>
  );
}
