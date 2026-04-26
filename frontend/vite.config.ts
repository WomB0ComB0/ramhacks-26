import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  // Both apps share one .env at the monorepo root.
  envDir: "..",
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
