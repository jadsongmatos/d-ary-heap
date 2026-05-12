"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Graphviz } from "@hpcc-js/wasm"
import { LevelArrayElement } from "./level-array-element"

interface AVLNode {
  value: number
  left: AVLNode | null
  right: AVLNode | null
  height: number
}

class AVLTree {
  root: AVLNode | null = null

  private getHeight(node: AVLNode | null): number {
    return node ? node.height : 0
  }

  private getBalance(node: AVLNode | null): number {
    return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0
  }

  private rotateRight(y: AVLNode): AVLNode {
    const x = y.left!
    const t2 = x.right
    x.right = y
    y.left = t2
    y.height = Math.max(this.getHeight(y.left), this.getHeight(y.right)) + 1
    x.height = Math.max(this.getHeight(x.left), this.getHeight(x.right)) + 1
    return x
  }

  private rotateLeft(x: AVLNode): AVLNode {
    const y = x.right!
    const t2 = y.left
    y.left = x
    x.right = t2
    x.height = Math.max(this.getHeight(x.left), this.getHeight(x.right)) + 1
    y.height = Math.max(this.getHeight(y.left), this.getHeight(y.right)) + 1
    return y
  }

  private insertNode(node: AVLNode | null, value: number): AVLNode {
    if (!node) {
      return { value, left: null, right: null, height: 1 }
    }
    if (value < node.value) {
      node.left = this.insertNode(node.left, value)
    } else if (value > node.value) {
      node.right = this.insertNode(node.right, value)
    } else {
      return node
    }

    node.height = Math.max(this.getHeight(node.left), this.getHeight(node.right)) + 1
    const balance = this.getBalance(node)

    if (balance > 1 && value < node.left!.value) {
      return this.rotateRight(node)
    }
    if (balance < -1 && value > node.right!.value) {
      return this.rotateLeft(node)
    }
    if (balance > 1 && value > node.left!.value) {
      node.left = this.rotateLeft(node.left!)
      return this.rotateRight(node)
    }
    if (balance < -1 && value < node.right!.value) {
      node.right = this.rotateRight(node.right!)
      return this.rotateLeft(node)
    }

    return node
  }

  insert(value: number): string[] {
    const rotations: string[] = []
    const beforeBalance = this.root ? this.getBalance(this.root) : 0
    this.root = this.insertNode(this.root, value)
    const afterBalance = this.root ? this.getBalance(this.root) : 0

    if (Math.abs(beforeBalance) > 1 && Math.abs(afterBalance) <= 1) {
      rotations.push(`Rotação realizada ao inserir ${value}`)
    }
    return rotations
  }

  levelOrderWithNulls(): (number | null)[] {
    if (!this.root) return []
    const result: (number | null)[] = []
    const queue: (AVLNode | null)[] = [this.root]

    while (queue.length > 0) {
      const node = queue.shift()!
      if (node) {
        result.push(node.value)
        const hasChildren = node.left !== null || node.right !== null
        const anyChildHasDescendants = queue.some(
          (n) => n !== null && (n!.left !== null || n!.right !== null)
        )
        if (hasChildren || anyChildHasDescendants || node.left !== null || node.right !== null) {
          queue.push(node.left)
          queue.push(node.right)
        }
      } else {
        let hasNonNullAfter = false
        for (let i = 0; i < queue.length; i++) {
          if (queue[i] !== null) {
            hasNonNullAfter = true
            break
          }
        }
        if (hasNonNullAfter) {
          result.push(null)
          queue.push(null)
          queue.push(null)
        }
      }
    }

    while (result.length > 0 && result[result.length - 1] === null) {
      result.pop()
    }

    return result
  }

  levelOrderLayers(): (number | null)[][] {
    if (!this.root) return []
    const layers: (number | null)[][] = []
    let currentLayer: (AVLNode | null)[] = [this.root]

    while (currentLayer.some((n) => n !== null)) {
      const values = currentLayer.map((n) => (n ? n.value : null))
      layers.push(values)
      const nextLayer: (AVLNode | null)[] = []
      for (const node of currentLayer) {
        if (node) {
          nextLayer.push(node.left)
          nextLayer.push(node.right)
        } else {
          nextLayer.push(null)
          nextLayer.push(null)
        }
      }
      currentLayer = nextLayer
    }

    return layers
  }

  contains(value: number): boolean {
    let node = this.root
    while (node) {
      if (value === node.value) return true
      if (value < node.value) node = node.left
      else node = node.right
    }
    return false
  }

  clear() {
    this.root = null
  }
}

interface SearchStep {
  index: number
  value: number | null
  direction: "left" | "right" | "found" | "not_found"
}

function generateDot(
  root: AVLNode | null,
  highlightedValues: Set<number>,
  searchPath: number[] = []
): string {
  if (!root) return 'digraph AVL {\n  node [shape=circle];\n  label="Árvore vazia";\n}\n'

  let dot = 'digraph AVL {\n'
  dot += '  graph [rankdir=TB, splines=true, nodesep=0.6, ranksep=0.8];\n'
  dot += '  node [shape=circle, style=filled, fontname="Arial", fixedsize=true, width=0.8];\n'
  dot += '  edge [arrowhead=none];\n\n'

  const queue: { node: AVLNode | null; index: number }[] = [{ node: root, index: 0 }]
  const nodeIndices = new Map<number, number>()
  nodeIndices.set(root.value, 0)

  const levelGroups: { [key: number]: number[] } = {}

  while (queue.length > 0) {
    const { node, index } = queue.shift()!
    if (!node) continue

    if (!levelGroups[index]) levelGroups[index] = []
    levelGroups[index].push(index)

    const isHighlighted = highlightedValues.has(node.value)
    const isSearchPath = searchPath.includes(node.value)
    let fillColor = "#e2e8f0"
    let fontColor = "black"
    if (isSearchPath) {
      fillColor = "#16a34a"
      fontColor = "white"
    } else if (isHighlighted) {
      fillColor = "#7c3aed"
      fontColor = "white"
    }

    const balance = getBalanceFromNode(node)
    dot += `  node${index} [label="${node.value}\\n(${balance})", fillcolor="${fillColor}", fontcolor="${fontColor}"];\n`

    if (node.left) {
      const leftIndex = 2 * index + 1
      nodeIndices.set(node.left.value, leftIndex)
      dot += `  node${index} -> node${leftIndex};\n`
      queue.push({ node: node.left, index: leftIndex })
    }
    if (node.right) {
      const rightIndex = 2 * index + 2
      nodeIndices.set(node.right.value, rightIndex)
      dot += `  node${index} -> node${rightIndex};\n`
      queue.push({ node: node.right, index: rightIndex })
    }
  }

  const levels: { [key: number]: number[] } = {}
  for (const [, idx] of nodeIndices) {
    const level = Math.floor(Math.log2(idx + 1))
    if (!levels[level]) levels[level] = []
    levels[level].push(idx)
  }
  for (const level in levels) {
    if (levels[level].length > 1) {
      dot += `  { rank=same; ${levels[level].map((i) => `node${i}`).join("; ")}; }\n`
    }
  }

  dot += "}\n"
  return dot
}

function getBalanceFromNode(node: AVLNode): number {
  const leftH = node.left ? node.left.height : 0
  const rightH = node.right ? node.right.height : 0
  return leftH - rightH
}

export function HeapVisualizer() {
  const [avlTree] = useState(() => new AVLTree())
  const [values, setValues] = useState<number[]>([])
  const [inputValue, setInputValue] = useState("")
  const [searchValue, setSearchValue] = useState("")
  const [dotSource, setDotSource] = useState("")
  const [svgString, setSvgString] = useState("")
  const [isGraphvizLoaded, setIsGraphvizLoaded] = useState(false)
  const [graphvizInstance, setGraphvizInstance] = useState<any>(null)
  const [highlightedValues, setHighlightedValues] = useState<Set<number>>(new Set())
  const [operationLog, setOperationLog] = useState<string[]>([])
  const [diskArray, setDiskArray] = useState<(number | null)[]>([])
  const [traversalLayers, setTraversalLayers] = useState<(number | null)[][]>([])
  const [currentTraversalLayer, setCurrentTraversalLayer] = useState(-1)
  const [searchSteps, setSearchSteps] = useState<SearchStep[]>([])
  const [currentSearchStep, setCurrentSearchStep] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [searchFound, setSearchFound] = useState<boolean | null>(null)
  const [highlightedArrayIndices, setHighlightedArrayIndices] = useState<Set<number>>(new Set())
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    const initGraphviz = async () => {
      try {
        const graphviz = await Graphviz.load()
        setGraphvizInstance(graphviz)
        setIsGraphvizLoaded(true)
      } catch (error) {
        console.error("Failed to initialize Graphviz:", error)
        toast({
          title: "Error",
          description: "Failed to initialize Graphviz visualization",
          variant: "destructive",
        })
      }
    }
    initGraphviz()
  }, [toast])

  const addLog = useCallback((message: string) => {
    setOperationLog((prev) => [message, ...prev.slice(0, 19)])
  }, [])

  useEffect(() => {
    if (isGraphvizLoaded && values.length > 0) {
      updateTreeVisualization()
    } else if (values.length === 0) {
      setDotSource("")
      setSvgString("")
    }
  }, [values, isGraphvizLoaded, highlightedValues])

  useEffect(() => {
    if (dotSource && isGraphvizLoaded && graphvizInstance) {
      renderGraphviz()
    }
  }, [dotSource, isGraphvizLoaded, graphvizInstance])

  useEffect(() => {
    if (values.length > 0) {
      setDiskArray(avlTree.levelOrderWithNulls())
      setTraversalLayers(avlTree.levelOrderLayers())
    } else {
      setDiskArray([])
      setTraversalLayers([])
    }
  }, [values, highlightedValues, avlTree])

  const updateTreeVisualization = () => {
    const dot = generateDot(avlTree.root, highlightedValues)
    setDotSource(dot)
  }

  const renderGraphviz = async () => {
    if (!dotSource || !graphvizInstance) return
    try {
      const svg = await graphvizInstance.layout(dotSource, "svg", "dot")
      setSvgString(svg)
    } catch (error) {
      console.error("Graphviz layout error:", error)
    }
  }

  const insertValue = () => {
    const value = Number.parseInt(inputValue)
    if (isNaN(value)) {
      toast({ title: "Invalid input", description: "Enter a valid number", variant: "destructive" })
      return
    }
    if (avlTree.contains(value)) {
      toast({ title: "Duplicate", description: `Value ${value} already exists`, variant: "destructive" })
      return
    }

    const rotations = avlTree.insert(value)
    setValues((prev) => [...prev, value])
    addLog(`Inserted: ${value}${rotations.length > 0 ? ` (${rotations.join(", ")})` : ""}`)
    setInputValue("")
    resetSearch()
  }

  const insertMultiple = (nums: number[]) => {
    for (const v of nums) {
      if (!avlTree.contains(v)) {
        avlTree.insert(v)
      }
    }
    setValues([...getInOrderValues(avlTree.root)])
    addLog(`Batch inserted: [${nums.join(", ")}]`)
    resetSearch()
  }

  const getInOrderValues = (node: AVLNode | null): number[] => {
    if (!node) return []
    return [...getInOrderValues(node.left), node.value, ...getInOrderValues(node.right)]
  }

  const generateRandomTree = () => {
    avlTree.clear()
    const count = Math.floor(Math.random() * 6) + 5
    const randomValues = new Set<number>()
    while (randomValues.size < count) {
      randomValues.add(Math.floor(Math.random() * 100))
    }
    const arr = Array.from(randomValues)
    for (const v of arr) {
      avlTree.insert(v)
    }
    setValues([...getInOrderValues(avlTree.root)])
    addLog(`Random tree: [${arr.join(", ")}]`)
    resetSearch()
  }

  const clearAll = () => {
    avlTree.clear()
    setValues([])
    setDiskArray([])
    setTraversalLayers([])
    setCurrentTraversalLayer(-1)
    resetSearch()
    setHighlightedValues(new Set())
    addLog("Cleared")
  }

  const resetSearch = () => {
    setSearchSteps([])
    setCurrentSearchStep(-1)
    setIsSearching(false)
    setSearchFound(null)
    setHighlightedArrayIndices(new Set())
    setHighlightedValues(new Set())
  }

  const animateTraversal = async () => {
    const layers = avlTree.levelOrderLayers()
    setTraversalLayers(layers)
    setCurrentTraversalLayer(-1)

    for (let i = 0; i < layers.length; i++) {
      setCurrentTraversalLayer(i)
      const layerValues = layers[i].filter((v) => v !== null) as number[]
      setHighlightedValues(new Set(layerValues))
      await new Promise((resolve) => setTimeout(resolve, 800))
    }

    setHighlightedValues(new Set())
    addLog(`Level traversal: [${avlTree.levelOrderWithNulls().map((v) => (v !== null ? v : "∅")).join(", ")}]`)
  }

  const performSearch = async () => {
    const target = Number.parseInt(searchValue)
    if (isNaN(target)) {
      toast({ title: "Invalid input", description: "Enter a valid number to search", variant: "destructive" })
      return
    }
    if (values.length === 0) {
      toast({ title: "Empty tree", description: "Insert values first", variant: "destructive" })
      return
    }

    resetSearch()
    setIsSearching(true)

    const array = avlTree.levelOrderWithNulls()
    const steps: SearchStep[] = []
    let index = 0
    let found = false

    while (index < array.length) {
      const currentValue = array[index]
      if (currentValue === null) {
        steps.push({ index, value: null, direction: "not_found" })
        break
      }

      if (target === currentValue) {
        steps.push({ index, value: currentValue, direction: "found" })
        found = true
        break
      } else if (target < currentValue) {
        steps.push({ index, value: currentValue, direction: "left" })
        index = 2 * index + 1
      } else {
        steps.push({ index, value: currentValue, direction: "right" })
        index = 2 * index + 2
      }
    }

    if (!found && (index >= array.length || array[index] === null)) {
      if (steps.length === 0 || steps[steps.length - 1].direction !== "not_found") {
        steps.push({ index, value: null, direction: "not_found" })
      }
    }

    setSearchSteps(steps)

    for (let i = 0; i < steps.length; i++) {
      setCurrentSearchStep(i)
      const step = steps[i]
      setHighlightedArrayIndices(new Set([step.index]))

      const pathValues = steps.slice(0, i + 1).map((s) => s.value).filter((v) => v !== null) as number[]
      setHighlightedValues(new Set(pathValues))

      const dot = generateDot(avlTree.root, new Set(), pathValues)
      setDotSource(dot)

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    const lastStep = steps[steps.length - 1]
    setSearchFound(lastStep.direction === "found")
    setIsSearching(false)

    if (lastStep.direction === "found") {
      addLog(`Search ${target}: FOUND at index ${lastStep.index}`)
    } else {
      addLog(`Search ${target}: NOT FOUND`)
    }
  }

  const getParentIndex = (i: number): number => Math.floor((i - 1) / 2)
  const getLeftChildIndex = (i: number): number => 2 * i + 1
  const getRightChildIndex = (i: number): number => 2 * i + 2

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">1. Construir Árvore AVL</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Insira valores para construir uma árvore AVL balanceada.
            </p>
            <div className="flex space-x-2 mb-3">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Valor"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && insertValue()}
                />
              </div>
              <Button onClick={insertValue}>Inserir</Button>
            </div>
            <div className="flex space-x-2 mb-3">
              <Input
                placeholder="Ex: 10,20,30 (Enter)"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const nums = (e.target as HTMLInputElement).value
                      .split(",")
                      .map((s) => Number.parseInt(s.trim()))
                      .filter((n) => !isNaN(n))
                    if (nums.length > 0) insertMultiple(nums)
                  }
                }}
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={generateRandomTree} variant="secondary" className="flex-1">
                Aleatório
              </Button>
              <Button onClick={clearAll} variant="destructive" className="flex-1">
                Limpar
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">2. Travessia em Nível</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Percorra a árvore camada por camada (BFS) para gerar a ordem de armazenamento.
            </p>
            <Button onClick={animateTraversal} className="w-full" disabled={values.length === 0}>
              Animar Travessia
            </Button>
            {currentTraversalLayer >= 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium">
                  Camada atual: {currentTraversalLayer}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {traversalLayers.slice(0, currentTraversalLayer + 1).map((layer, li) => (
                    <span key={li} className="text-xs bg-muted px-2 py-1 rounded">
                      [{layer.map((v) => (v !== null ? v : "∅")).join(", ")}]
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">5. Busca Binária</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Busque um valor navegando pela árvore usando indexação heap no array em disco.
            </p>
            <div className="flex space-x-2 mb-3">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Buscar valor"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && performSearch()}
                />
              </div>
              <Button onClick={performSearch} disabled={isSearching || values.length === 0}>
                Buscar
              </Button>
            </div>
            {searchSteps.length > 0 && (
              <div className="space-y-1">
                {searchSteps.map((step, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded ${
                      i <= currentSearchStep
                        ? step.direction === "found"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                          : step.direction === "not_found"
                            ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                            : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    Índice {step.index}: valor = {step.value ?? "∅"} →{" "}
                    {step.direction === "found"
                      ? "Encontrado!"
                      : step.direction === "not_found"
                        ? "Não encontrado (posição vazia)"
                        : step.direction === "left"
                          ? `${step.value} > alvo → filho esquerdo (índice ${getLeftChildIndex(step.index)})`
                          : `${step.value} < alvo → filho direito (índice ${getRightChildIndex(step.index)})`}
                  </div>
                ))}
              </div>
            )}
            {searchFound !== null && (
              <p className={`text-sm font-medium mt-2 ${searchFound ? "text-green-600" : "text-red-600"}`}>
                {searchFound ? `Valor ${searchValue} encontrado!` : `Valor ${searchValue} não encontrado.`}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">Informações</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Total de nós: {values.length}</li>
              {values.length > 0 && (
                <>
                  <li>Raiz: {diskArray[0] ?? "—"}</li>
                  <li>Altura: {traversalLayers.length}</li>
                  <li>Array em disco: {diskArray.length} posições</li>
                </>
              )}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Tabs defaultValue="avl-tree">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="avl-tree">Árvore AVL</TabsTrigger>
              <TabsTrigger value="disk-array">Array em Disco</TabsTrigger>
              <TabsTrigger value="heap-index">Indexação Heap</TabsTrigger>
              <TabsTrigger value="dot">DOT</TabsTrigger>
            </TabsList>

            <TabsContent value="avl-tree" className="p-0">
              <Card className="p-4 min-h-[400px] flex items-center justify-center overflow-auto">
                {isGraphvizLoaded ? (
                  svgString ? (
                    <div
                      ref={svgContainerRef}
                      dangerouslySetInnerHTML={{ __html: svgString }}
                      className="w-full h-full flex items-center justify-center"
                    />
                  ) : (
                    <p className="text-muted-foreground">Insira valores para visualizar a árvore AVL</p>
                  )
                ) : (
                  <p className="text-muted-foreground">Carregando Graphviz...</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="disk-array" className="p-0">
              <Card className="p-4 min-h-[400px] overflow-auto">
                <h3 className="text-lg font-medium mb-2">3. Armazenamento em Disco</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Elementos armazenados em ordem de travessia em nível, com posições nulas para manter a indexação heap.
                </p>
                {diskArray.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {diskArray.map((value, index) => (
                        <div
                          key={index}
                          className={`flex flex-col items-center justify-center w-14 h-14 rounded-md border text-sm ${
                            highlightedArrayIndices.has(index)
                              ? searchSteps[currentSearchStep]?.direction === "found"
                                ? "bg-green-500 text-white border-green-600"
                                : "bg-primary text-primary-foreground"
                              : value === null
                                ? "bg-muted/30 border-dashed text-muted-foreground"
                                : "bg-card"
                          }`}
                        >
                          <span className="font-mono text-xs text-muted-foreground">[{index}]</span>
                          <span className="font-bold">{value !== null ? value : "∅"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Pai: (i-1)/2 | Filho esquerdo: 2i+1 | Filho direito: 2i+2</p>
                      <p>Posições ∅ = null (mantêm a estrutura de indexação)</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Construa a árvore para ver o array em disco</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="heap-index" className="p-0">
              <Card className="p-4 min-h-[400px] overflow-auto">
                <h3 className="text-lg font-medium mb-2">4. Indexação Heap</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Relações pai-filho usando indexação heap. Cada posição é calculada por aritmética de índices.
                </p>
                {diskArray.length > 0 ? (
                  <div className="space-y-3">
                    {diskArray.map((value, index) => {
                      if (value === null) return null
                      const parentIdx = index > 0 ? getParentIndex(index) : null
                      const leftIdx = getLeftChildIndex(index)
                      const rightIdx = getRightChildIndex(index)
                      const leftVal = leftIdx < diskArray.length ? diskArray[leftIdx] : null
                      const rightVal = rightIdx < diskArray.length ? diskArray[rightIdx] : null
                      const parentVal = parentIdx !== null ? diskArray[parentIdx] : null

                      return (
                        <div
                          key={index}
                          className={`flex items-center gap-3 p-2 rounded border text-sm ${
                            highlightedArrayIndices.has(index) ? "bg-primary/10 border-primary" : "bg-card"
                          }`}
                        >
                          <div className="font-mono font-bold w-8 text-center">{value}</div>
                          <div className="text-xs text-muted-foreground flex-1">
                            <span className="font-mono">[{index}]</span>
                            {parentIdx !== null && parentVal !== null && (
                              <span className="ml-2">
                                ↑ pai=[{parentIdx}]:{parentVal}
                              </span>
                            )}
                            {leftVal !== null && (
                              <span className="ml-2">
                                ← esq=[{leftIdx}]:{leftVal}
                              </span>
                            )}
                            {rightVal !== null && (
                              <span className="ml-2">
                                → dir=[{rightIdx}]:{rightVal}
                              </span>
                            )}
                            {leftVal === null && leftIdx < diskArray.length && (
                              <span className="ml-2 text-muted-foreground/50">← esq=[{leftIdx}]:∅</span>
                            )}
                            {rightVal === null && rightIdx < diskArray.length && (
                              <span className="ml-2 text-muted-foreground/50">→ dir=[{rightIdx}]:∅</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Construa a árvore para ver a indexação</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="dot" className="p-0">
              <Card className="p-4 min-h-[400px]">
                <pre className="text-xs overflow-auto h-[400px] font-mono">
                  {dotSource || "// Nenhum DOT gerado ainda"}
                </pre>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">Log de Operações</h3>
            <div className="text-sm h-[150px] overflow-y-auto space-y-1">
              {operationLog.length > 0 ? (
                operationLog.map((log, index) => (
                  <div key={index} className="py-1 border-b last:border-0">
                    {log}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Nenhuma operação realizada</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <h3 className="text-lg font-medium mb-2">Metodologia: Busca Eficiente em Disco</h3>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>1. Árvore AVL:</strong> Garante balanceamento automático, mantendo a altura mínima (O(log n)).
          </p>
          <p>
            <strong>2. Travessia em Nível:</strong> Percorre a árvore camada por camada (BFS), gerando a ordem de armazenamento.
          </p>
          <p>
            <strong>3. Armazenamento em Disco:</strong> Os elementos são escritos sequencialmente, incluindo posições nulas (∅) para manter a indexação.
          </p>
          <p>
            <strong>4. Indexação Heap:</strong> Pai = (i-1)/2, Filho esquerdo = 2i+1, Filho direito = 2i+2. Permite navegar pela árvore usando apenas aritmética de índices, sem ponteiros.
          </p>
          <p>
            <strong>5. Busca Binária:</strong> Começa na raiz (índice 0). Compara o valor buscado com o nó atual e navega para o filho esquerdo ou direito usando as fórmulas de indexação heap. Complexidade: O(log n).
          </p>
        </div>
      </Card>
    </div>
  )
}
