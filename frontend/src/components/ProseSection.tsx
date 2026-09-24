import type { ReactNode } from 'react'

interface ProseSectionProps {
  id?: string
  title: string
  children: ReactNode
}

// A titled block of running text — the legal pages and the FAQ.
export function ProseSection({ id, title, children }: ProseSectionProps) {
  return (
    <section id={id} className="flex flex-col gap-2 scroll-mt-4 text-ink-soft">
      <h2 className="font-serif text-xl text-primary">{title}</h2>
      {children}
    </section>
  )
}

// The operator's postal address, as the Impressum and the Datenschutzerklärung name it.
export function OperatorAddress() {
  return (
    <>
      Bernd Löffeld
      <br />
      Gleyeweg 61
      <br />
      10318 Berlin
    </>
  )
}
