/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_TIMEOUT_MS?: string
  readonly VITE_LOCALE?: string
  readonly VITE_MOEDA?: string
  readonly VITE_IDADE_MINIMA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
