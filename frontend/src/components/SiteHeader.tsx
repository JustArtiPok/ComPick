import { NavLink, useNavigate } from 'react-router'

const NAV = [
  { to: '/configurator', label: 'Конфигуратор' },
  { to: '/builds', label: 'Готовые сборки' },
  { to: '/catalog', label: 'Комплектующие' },
  { to: '/stores', label: 'Магазины' },
]

export default function SiteHeader() {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-40 border-b border-[#E8E9EE] bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:gap-8">
        <NavLink to="/" className="flex shrink-0 items-center gap-2">
          <span className="inline-block h-6 w-6 rounded-[6px] bg-[#2E44D6]" aria-hidden />
          <span className="text-lg font-semibold tracking-tight text-[#16181D]">ComPick</span>
        </NavLink>
        <nav className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto md:justify-center md:gap-7">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap text-sm transition-colors hover:text-[#16181D] ${
                  isActive ? 'font-medium text-[#16181D]' : 'text-[#6B6F7B]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => navigate('/configurator')}
          className="shrink-0 rounded-lg border border-[#E8E9EE] px-4 py-2 text-sm font-medium text-[#16181D] transition-colors hover:bg-[#F5F6F8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2E44D6]"
        >
          Войти
        </button>
      </div>
    </header>
  )
}
