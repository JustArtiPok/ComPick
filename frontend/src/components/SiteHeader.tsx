import { NavLink } from 'react-router'

const NAV = [
  { to: '/pick', label: 'Подбор' },
  { to: '/configurator', label: 'Конфигуратор' },
  { to: '/catalog', label: 'Каталог' },
  { to: '/help', label: 'Справка' },
]

export default function SiteHeader() {
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
      </div>
    </header>
  )
}
