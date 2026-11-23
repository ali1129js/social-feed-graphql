import { useEffect, useMemo, useState } from "react";
import { Provider } from "urql";
import { FeedPage } from "./feed/FeedPage";
import { useStoredState } from "./hooks/useStoredState";
import { readToken, writeToken } from "./lib/auth";
import { createUrqlClient } from "./lib/client";
import { STRINGS } from "./lib/i18n";
import {
  KEYS,
  defaultLocale,
  defaultMotion,
  defaultTheme,
  localeSchema,
  motionSchema,
  themeSchema,
} from "./lib/storage";
import type { LocaleName, MotionName, ThemeName } from "./lib/types";
import { LocaleToggle } from "./theme/LocaleToggle";
import { MotionToggle } from "./theme/MotionToggle";
import { ThemeSwitcher } from "./theme/ThemeSwitcher";
import { applyMotion, applyTheme, prefersReducedMotion } from "./theme/themes";

export function App() {
  const [theme, setTheme] = useStoredState<ThemeName>(KEYS.theme, themeSchema, defaultTheme());
  const [motion, setMotion] = useStoredState<MotionName>(
    KEYS.motion,
    motionSchema,
    defaultMotion(),
  );
  const [locale, setLocale] = useStoredState<LocaleName>(
    KEYS.locale,
    localeSchema,
    defaultLocale(),
  );
  const [reduced] = useState(() => prefersReducedMotion());
  const [token, setToken] = useState<string | undefined>(() => readToken());
  const client = useMemo(() => createUrqlClient({ getToken: () => token }), [token]);
  const t = STRINGS[locale];

  useEffect(() => applyTheme(theme), [theme]);
  useEffect(() => applyMotion(motion, document.documentElement, reduced), [motion, reduced]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t.documentTitle;
  }, [locale, t.documentTitle]);

  function onAuthChange(next: string | undefined) {
    writeToken(next);
    setToken(next);
  }

  return (
    <Provider value={client}>
      <div className="app">
        <a className="skip-link" href="#main">
          {t.skipToContent}
        </a>
        <header className="app-header">
          <div>
            <h1 className="app-title">{t.title}</h1>
            <p className="app-sub">{t.subtitle}</p>
          </div>
          <div className="theme-tools">
            <ThemeSwitcher value={theme} onChange={setTheme} strings={t} />
            <MotionToggle value={motion} onChange={setMotion} reducedMotion={reduced} strings={t} />
            <LocaleToggle value={locale} onChange={setLocale} strings={t} />
          </div>
        </header>
        <main id="main" className="app-main" tabIndex={-1}>
          <FeedPage locale={locale} strings={t} token={token} onAuthChange={onAuthChange} />
        </main>
      </div>
    </Provider>
  );
}
