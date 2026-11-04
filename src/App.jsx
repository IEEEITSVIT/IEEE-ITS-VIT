import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect } from 'react'
import { useSite } from './context/SiteContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Preloader from './components/Preloader'
import ScrollProgress from './components/ScrollProgress'
import ThemeApplier from './components/ThemeApplier'
import AnnouncementBar from './components/AnnouncementBar'
import SitePopup from './components/SitePopup'
import PageHeader from './components/PageHeader'
import Seo from './components/Seo'
import Home from './pages/Home'
import Blogs from './pages/Blogs'
import FAQ from './pages/FAQ'
import Moments from './pages/Moments'
import EventTimeline from './pages/EventTimeline'
import EventDetail from './pages/EventDetail'
import JoinUs from './pages/JoinUs'
import Login from './pages/Login'
import Faculty from './pages/Faculty'
import Games from './pages/Games'
import Merch from './pages/Merch'
import WebTeam from './pages/WebTeam'
import Suggestions from './pages/Suggestions'
import Vlogs from './pages/Vlogs'
import Contact from './pages/Contact'

// The admin dashboard is code-split so it never weighs down the public site.
const AdminApp = lazy(() => import('./admin/AdminApp'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  return null
}

function Page({ children }) {
  return (
    <motion.main id="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      {children}
    </motion.main>
  )
}

function NotFound() {
  return <><Seo title="Not found" noindex /><PageHeader title="Page not found" overline="404" subtitle="The page you are looking for has moved or no longer exists." /></>
}

function BootError({ error, retry }) {
  return (
    <div className="boot-error">
      <div className="form" style={{ alignItems: 'center' }}>
        <span className="label">Connection problem</span>
        <p className="muted">We could not load the site content ({error}).</p>
        <button className="btn solid" onClick={() => retry(true)}>Try again</button>
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const { ready, error, refresh } = useSite()

  if (location.pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="admin-boot">Loading dashboard…</div>}>
        <AdminApp />
      </Suspense>
    )
  }

  // Blog articles share one page component, so keep them under a single transition key.
  const key = location.pathname.startsWith('/blogs') ? '/blogs' : location.pathname

  return (
    <>
      <ThemeApplier />
      <Preloader />
      {!ready && error && <BootError error={error} retry={refresh} />}
      {ready && (
        <>
          <ScrollToTop />
          <ScrollProgress />
          <AnnouncementBar />
          <Navbar />
          <SitePopup />
          <AnimatePresence mode="wait">
            <Page key={key}>
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/blogs" element={<Blogs />} />
                <Route path="/blogs/:slug" element={<Blogs />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/moments" element={<Moments />} />
                <Route path="/timeline" element={<EventTimeline />} />
                <Route path="/events" element={<EventTimeline />} />
                <Route path="/events/:slug" element={<EventDetail />} />
                <Route path="/join" element={<JoinUs />} />
                <Route path="/login" element={<Login />} />
                <Route path="/faculty" element={<Faculty />} />
                <Route path="/games" element={<Games />} />
                <Route path="/merch" element={<Merch />} />
                <Route path="/web-team" element={<WebTeam />} />
                <Route path="/suggestions" element={<Suggestions />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/vlogs" element={<Vlogs />} />
                <Route path="/quanta-26" element={<EventDetail slug="quanta-26" />} />
                <Route path="/qunata-26" element={<EventDetail slug="quanta-26" />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Page>
          </AnimatePresence>
          <Footer />
        </>
      )}
    </>
  )
}

export default App
