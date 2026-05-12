import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AVL + Heap Indexing — Busca Eficiente em Disco',
  description: 'Visualização de busca eficiente em disco usando árvore AVL com indexação heap',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
