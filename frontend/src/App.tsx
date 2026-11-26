import { Routes, Route } from 'react-router'
import SiteHeader from '@/components/SiteHeader'
import Home from '@/pages/Home'
import Pick from '@/pages/Pick'
import Configurator from '@/pages/Configurator'
import ReplaceComponent from '@/pages/ReplaceComponent'
import Catalog from '@/pages/Catalog'
import ComponentDetail from '@/pages/ComponentDetail'
import ReadyBuilds from '@/pages/ReadyBuilds'
import Help from '@/pages/Help'
import AboutData from '@/pages/AboutData'

export default function App() {
  return (
    <div className="min-h-dvh bg-white">
      <SiteHeader />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pick" element={<Pick />} />
        <Route path="/configurator" element={<Configurator />} />
        <Route path="/configurator/replace/:category" element={<ReplaceComponent />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/catalog/:id" element={<ComponentDetail />} />
        <Route path="/builds" element={<ReadyBuilds />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/data" element={<AboutData />} />
      </Routes>
    </div>
  )
}
