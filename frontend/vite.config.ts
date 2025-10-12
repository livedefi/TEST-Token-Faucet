import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  // Expose selected non-VITE_ env vars to client code
  envPrefix: ['VITE_', 'WALLETCONNECT_', 'SEPOLIA_', 'SIMPLE_', 'TOKEN_'],
})
