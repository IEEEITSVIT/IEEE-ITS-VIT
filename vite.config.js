import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function servePicAndGenerateList() {
  return {
    name: 'serve-pic-and-generate-list',
    configureServer(server) {
      // 1. Generate list when server starts
      generateList()

      // 2. Watch 'pic' directory for changes to regenerate the list
      const picPath = path.resolve(__dirname, 'pic')
      server.watcher.add(picPath)
      
      const handleChange = (filePath) => {
        if (filePath.startsWith(picPath)) {
          generateList()
        }
      }
      
      server.watcher.on('add', handleChange)
      server.watcher.on('unlink', handleChange)

      // 3. Serve the 'pic' directory at '/pic' prefix
      server.middlewares.use('/pic', (req, res, next) => {
        const urlPath = decodeURIComponent(req.url.split('?')[0])
        const filePath = path.join(picPath, urlPath)
        
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase()
          let mime = 'application/octet-stream'
          if (ext === '.png') mime = 'image/png'
          else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg'
          else if (ext === '.gif') mime = 'image/gif'
          else if (ext === '.svg') mime = 'image/svg+xml'
          else if (ext === '.webp') mime = 'image/webp'
          
          res.setHeader('Content-Type', mime)
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },
    buildStart() {
      // Generate list during production build
      generateList()
    },
    closeBundle() {
      // Copy 'pic' folder to 'dist/pic' for production build
      const picDir = path.resolve(__dirname, 'pic')
      const distPicDir = path.resolve(__dirname, 'dist/pic')
      if (fs.existsSync(picDir)) {
        copyFolderRecursiveSync(picDir, distPicDir)
        console.log(`[serve-pic] Copied 'pic' directory to '${distPicDir}' for production build.`)
      }
    }
  }
}

function generateList() {
  const picDir = path.resolve(__dirname, 'pic')
  if (!fs.existsSync(picDir)) {
    fs.mkdirSync(picDir, { recursive: true })
  }
  const files = fs.readdirSync(picDir)
  const images = files.filter(file => /\.(png|jpe?g|webp|gif|svg)$/i.test(file))
  
  const dataDir = path.resolve(__dirname, 'src/data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  
  fs.writeFileSync(
    path.join(dataDir, 'carouselImages.json'), 
    JSON.stringify(images, null, 2)
  );
  console.log(`[serve-pic] Generated list of ${images.length} images from 'pic' folder.`)
}

function copyFolderRecursiveSync(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true })
  }
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source)
    files.forEach(file => {
      const curSource = path.join(source, file)
      const curTarget = path.join(target, file)
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, curTarget)
      } else {
        fs.copyFileSync(curSource, curTarget)
      }
    })
  }
}

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
    plugins: [react(), servePicAndGenerateList(), apiDevServer()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], motion: ['framer-motion'] },
        },
      },
    },
  }
})
