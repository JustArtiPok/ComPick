import { Routes, Route } from 'react-router'
import SiteHeader from '@/components/SiteHeader'
import Home from '@/pages/Home'
import Configurator from '@/pages/Configurator'
import Catalog from '@/pages/Catalog'
import ReadyBuilds from '@/pages/ReadyBuilds'
import Stores from '@/pages/Stores'

export default function App() {
  return (
    <div className="min-h-dvh bg-white">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/configurator" element={<Configurator />} />
        <Route path="/builds" element={<ReadyBuilds />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/stores" element={<Stores />} />
      </Routes>
    </div>
  )
}
