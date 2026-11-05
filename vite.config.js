import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/* Mounts the same API that runs on Vercel (server/router.js) inside the Vite dev server,
   so `npm run dev` serves the site, /api, /sitemap.xml and /robots.txt together. */
function apiDevServer() {
  return {
    name: 'ieee-its-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url.split('?')[0]
        const alias = { '/sitemap.xml': '/api/sitemap.xml', '/robots.txt': '/api/robots.txt' }[pathname]
        if (!alias && !pathname.startsWith('/api/')) return next()
        try {
          const { handle } = await server.ssrLoadModule('/server/router.js')
          await handle(req, res, alias)
        } catch (e) {
          console.error(e)
          res.statusCode = 500
          res.end(JSON.stringify({ error: e.message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Expose .env / .env.local to the API code running inside the dev server.
  Object.assign(process.env, { ...loadEnv(mode, process.cwd(), ''), ...process.env })
  return {
    plugins: [react(), apiDevServer()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], motion: ['framer-motion'] },
        },
      },
    },
  }
})
