import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IntlMessageFormat } from 'intl-messageformat';

type Dict = Record<string, string>;
type Vars = Record<string, unknown>;

interface I18nCtx {
  lang: string;
  t: (key: string, vars?: Vars) => string;
  setLang: (lang: string) => void;
}

const Ctx = createContext<I18nCtx>({ lang: 'en', t: (k) => k, setLang: () => {} });
export const useI18n = () => useContext(Ctx);

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: string;
  children: React.ReactNode;
}) {
  const [lang, setLangState] = useState(initialLang);
  const [messages, setMessages] = useState<Dict>({});
  const cache = useRef<Map<string, IntlMessageFormat>>(new Map());

  const load = useCallback(async (l: string) => {
    try {
      const res = await fetch(`/api/i18n/${encodeURIComponent(l)}`);
      if (!res.ok) return;
      const data = (await res.json()) as { lang: string; messages: Dict };
      cache.current.clear();
      setMessages(data.messages ?? {});
      setLangState(data.lang ?? l);
    } catch {
      /* keep current language on failure */
    }
  }, []);

  useEffect(() => {
    void load(initialLang);
  }, [load, initialLang]);

  const t = useCallback(
    (key: string, vars?: Vars) => {
      const raw = messages[key];
      if (raw == null) return key;
      if (!raw.includes('{')) return raw;
      let fmt = cache.current.get(key);
      if (!fmt) {
        fmt = new IntlMessageFormat(raw, lang);
        cache.current.set(key, fmt);
      }
      return String(fmt.format(vars ?? {}));
    },
    [messages, lang],
  );

  const setLang = useCallback((l: string) => void load(l), [load]);

  return <Ctx.Provider value={{ lang, t, setLang }}>{children}</Ctx.Provider>;
}
