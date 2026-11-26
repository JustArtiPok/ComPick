import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { GLOSSARY } from '@/lib/glossary'

export default function Help() {
  const [q, setQ] = useState('')
  const terms = useMemo(
    () =>
      GLOSSARY.filter(
        (t) =>
          !q ||
          t.term.toLowerCase().includes(q.toLowerCase()) ||
          t.text.toLowerCase().includes(q.toLowerCase()),
      ),
    [q],
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight text-[#16181D]">Глоссарий терминов</h1>
      <p className="mt-2 text-sm text-[#6B6F7B]">Короткие пояснения простым языком</p>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Найти термин"
        aria-label="Найти термин"
        className="mt-5 w-full rounded-lg border border-[#E8E9EE] px-3 py-2.5 text-sm outline-none focus:border-[#2E44D6]"
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {terms.map((t) => (
          <article key={t.term} className="rounded-2xl border border-[#E8E9EE] bg-white p-5">
            <h2 className="text-base font-semibold text-[#16181D]">{t.term}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6B6F7B]">{t.text}</p>
          </article>
        ))}
        {terms.length === 0 && (
          <p className="text-sm text-[#9AA0AB]">Такого термина в глоссарии нет.</p>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-[#E8E9EE] bg-white p-5">
        <h2 className="text-base font-semibold text-[#16181D]">О данных</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B6F7B]">
          Откуда берутся цены, как часто они обновляются и что значит «цена не определена».
        </p>
        <Link
          to="/help/data"
          className="mt-3 inline-block rounded-lg border border-[#E8E9EE] px-4 py-2 text-sm font-medium text-[#16181D] hover:bg-[#F5F6F8]"
        >
          Читать
        </Link>
      </div>
    </main>
  )
}
