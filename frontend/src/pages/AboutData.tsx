import { Link } from 'react-router'

export default function AboutData() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <nav className="text-sm text-[#6B6F7B]" aria-label="Хлебные крошки">
        <Link to="/help" className="hover:text-[#16181D]">Справка</Link>
        {' / О данных'}
      </nav>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#16181D]">О данных</h1>
      <p className="mt-2 text-sm text-[#6B6F7B]">Откуда берутся цены и как часто они обновляются</p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <h2 className="text-base font-semibold text-[#16181D]">Демо-данные</h2>
          <span className="mt-2 inline-block rounded-full bg-[#FFF6E5] px-2.5 py-1 text-xs font-medium text-[#B26A00]">
            Демонстрационный срез
          </span>
          <p className="mt-3 text-sm leading-relaxed text-[#6B6F7B]">
            Каталог собран вручную из открытых предложений DNS, Ситилинка и Регарда. Цены и наличие
            показаны для демонстрации работы конфигуратора.
          </p>
        </article>
        <article className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <h2 className="text-base font-semibold text-[#16181D]">Обновление цен</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6B6F7B]">
            Цены обновляются вручную, ориентировочно раз в месяц. Если данным больше месяца, рядом
            с ценой появляется пометка «Не актуально» — перед заказом проверьте её в магазине.
          </p>
        </article>
        <article className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
          <h2 className="text-base font-semibold text-[#16181D]">Если цены нет</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#6B6F7B]">
            Мы явно пишем «Цена не определена», а не показываем ноль. Такая деталь не входит в
            итоговую сумму сборки.
          </p>
        </article>
      </div>
    </main>
  )
}
