/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Both set: groups sync through Supabase. Either missing: the fake server in localStorage. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
