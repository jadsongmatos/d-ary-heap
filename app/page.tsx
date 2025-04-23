import { HeapVisualizer } from "@/components/heap-visualizer"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 md:p-8">
      <div className="w-full max-w-5xl">
        <h1 className="text-3xl font-bold mb-6 text-center">D-ary Heap Visualizer (Graphviz)</h1>
        <HeapVisualizer />
      </div>
    </main>
  )
}
