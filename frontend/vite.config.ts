import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Domain kommt aus APP_DOMAIN (.env) - Vite blockt sonst per Default jeden
// Host, der nicht localhost/eine bekannte IP ist (Schutz vor DNS-Rebinding).
const appDomain = process.env.APP_DOMAIN

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    allowedHosts: appDomain ? [appDomain] : undefined,
  },
})
