"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Graphviz } from "@hpcc-js/wasm"
import { LevelArrayElement } from "./level-array-element"

type HeapType = "min" | "max"

interface HeapNode {
  value: number
  x: number
  y: number
  highlighted?: boolean
}

interface LevelArrayElementProps {
  value: number
  parentValue: number | null
  parentIndex: number | null
  isHighlighted: boolean
}

export function HeapVisualizer() {
  const [d, setD] = useState<number>(2)
  const [heapType, setHeapType] = useState<HeapType>("min")
  const [inputValue, setInputValue] = useState<string>("")
  const [heap, setHeap] = useState<number[]>([])
  const [dotSource, setDotSource] = useState<string>("")
  const [svgString, setSvgString] = useState<string>("")
  const [highlightedNodes, setHighlightedNodes] = useState<number[]>([])
  const [operationLog, setOperationLog] = useState<string[]>([])
  const [isGraphvizLoaded, setIsGraphvizLoaded] = useState<boolean>(false)
  const [graphvizInstance, setGraphvizInstance] = useState<any>(null)
  const [nodes, setNodes] = useState<HeapNode[]>([])
  const [edges, setEdges] = useState<{ from: number; to: number }[]>([])
  const [animationQueue, setAnimationQueue] = useState<{ type: string; data: any }[]>([])
  const [isAnimating, setIsAnimating] = useState<boolean>(false)
  const [svgWidth, setSvgWidth] = useState<number>(800)
  const [svgHeight, setSvgHeight] = useState<number>(500)
  const [levelArrays, setLevelArrays] = useState<LevelArrayElementProps[][]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Initialize Graphviz
  useEffect(() => {
    const initGraphviz = async () => {
      try {
        const graphviz = await Graphviz.load()
        setGraphvizInstance(graphviz)
        setIsGraphvizLoaded(true)
        console.log("Graphviz initialized")
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

  // Calculate SVG dimensions based on container size
  useEffect(() => {
    const updateSize = () => {
      if (svgRef.current) {
        const container = svgRef.current.parentElement
        if (container) {
          setSvgWidth(container.clientWidth)
          setSvgHeight(Math.max(500, container.clientWidth * 0.6))
        }
      }
    }

    window.addEventListener("resize", updateSize)
    updateSize()

    return () => window.removeEventListener("resize", updateSize)
  }, [])

  // Process animation queue
  useEffect(() => {
    if (animationQueue.length > 0 && !isAnimating) {
      setIsAnimating(true)
      const action = animationQueue[0]

      setTimeout(() => {
        if (action.type === "highlight") {
          highlightNode(action.data)
        } else if (action.type === "swap") {
          performSwap(action.data.index1, action.data.index2)
        } else if (action.type === "final") {
          updateVisualization()
        }

        setAnimationQueue((prev) => prev.slice(1))
        setIsAnimating(false)
      }, 500)
    }
  }, [animationQueue, isAnimating])

  // Update visualization whenever heap changes
  useEffect(() => {
    if (isGraphvizLoaded) {
      updateVisualization()
    }
  }, [heap, d, heapType, highlightedNodes, isGraphvizLoaded])

  // Render SVG when dotSource changes
  useEffect(() => {
    if (dotSource && isGraphvizLoaded && graphvizInstance) {
      renderGraphviz()
    }
  }, [dotSource, isGraphvizLoaded, graphvizInstance])

  // Update level arrays visualization
  useEffect(() => {
    updateLevelArrays()
  }, [heap, d, highlightedNodes])

  const updateLevelArrays = () => {
    if (!heap.length) {
      setLevelArrays([])
      return
    }

    // Find the maximum depth by checking each node
    let maxDepth = 0
    for (let i = 0; i < heap.length; i++) {
      const nodeDepth = Math.floor(Math.log((d - 1) * i + 1) / Math.log(d))
      maxDepth = Math.max(maxDepth, nodeDepth)
    }

    // Add 1 to maxDepth since depths are 0-indexed
    maxDepth += 1

    // Initialize the levels array with the correct size
    const levels: LevelArrayElementProps[][] = Array(maxDepth)
      .fill(null)
      .map(() => [])

    // Organize nodes by level
    for (let i = 0; i < heap.length; i++) {
      const depth = Math.floor(Math.log((d - 1) * i + 1) / Math.log(d))

      // This should always be true now, but keep as a safety check
      if (depth >= 0 && depth < levels.length) {
        const parentIndex = i > 0 ? Math.floor((i - 1) / d) : null

        levels[depth].push({
          value: heap[i],
          parentValue: parentIndex !== null ? heap[parentIndex] : null,
          parentIndex: parentIndex,
          isHighlighted: highlightedNodes.includes(i),
        })
      } else {
        console.error(`Calculated depth ${depth} is out of bounds for levels array of length ${levels.length}`)
      }
    }

    setLevelArrays(levels)
  }

  const updateVisualization = () => {
    if (!heap.length) {
      setDotSource("")
      setSvgString("")
      setNodes([])
      setEdges([])
      return
    }

    // Generate DOT language representation of the heap
    let dot = `digraph D_ary_Heap {\n`
    dot += `  graph [rankdir=TB, splines=true, nodesep=0.6, ranksep=0.8];\n`
    dot += `  node [shape=circle, style=filled, fontname="Arial", fixedsize=true, width=0.8];\n`
    dot += `  edge [arrowhead=none];\n\n`

    // Add nodes
    for (let i = 0; i < heap.length; i++) {
      const isHighlighted = highlightedNodes.includes(i)
      const fillColor = isHighlighted ? "#7c3aed" : heapType === "min" ? "#e2e8f0" : "#e2e8f0"
      const fontColor = isHighlighted ? "white" : "black"
      const label = heap[i].toString()

      dot += `  node${i} [label="${label}", fillcolor="${fillColor}", fontcolor="${fontColor}"];\n`
    }

    dot += "\n"

    // Add edges
    for (let i = 1; i < heap.length; i++) {
      const parentIndex = Math.floor((i - 1) / d)
      dot += `  node${parentIndex} -> node${i};\n`
    }

    // Group nodes by level for better visualization
    const levels: { [key: number]: number[] } = {}
    for (let i = 0; i < heap.length; i++) {
      const level = Math.floor(Math.log((d - 1) * i + 1) / Math.log(d))
      if (!levels[level]) {
        levels[level] = []
      }
      levels[level].push(i)
    }

    // Add rank constraints to ensure nodes at the same level are aligned
    for (const level in levels) {
      if (levels[level].length > 1) {
        dot += `  { rank=same; ${levels[level].map((i) => `node${i}`).join("; ")}; }\n`
      }
    }

    dot += "}\n"
    setDotSource(dot)

    if (!heap.length) {
      setNodes([])
      setEdges([])
      return
    }

    const newNodes: HeapNode[] = []
    const newEdges: { from: number; to: number }[] = []

    // Calculate the maximum depth of the heap
    const getMaxDepth = () => {
      let size = heap.length
      let depth = 0
      while (size > 0) {
        size = Math.floor((size - 1) / d)
        depth++
      }
      return depth
    }

    const maxDepth = getMaxDepth()
    const horizontalSpacing = svgWidth / (Math.pow(d, maxDepth - 1) + 1)
    const verticalSpacing = svgHeight / (maxDepth + 1)

    // Create nodes with positions
    for (let i = 0; i < heap.length; i++) {
      const depth = Math.floor(Math.log(i * (d - 1) + 1) / Math.log(d))
      const nodesInLevel = Math.pow(d, depth)
      const levelStartIndex = (Math.pow(d, depth) - 1) / (d - 1)
      const positionInLevel = i - levelStartIndex

      // Calculate x position to center nodes at each level
      const levelWidth = nodesInLevel * horizontalSpacing
      const startX = (svgWidth - levelWidth) / 2 + horizontalSpacing / 2
      const x = startX + positionInLevel * horizontalSpacing
      const y = (depth + 1) * verticalSpacing

      newNodes.push({
        value: heap[i],
        x,
        y,
        highlighted: false,
      })

      // Create edges from parent to children
      if (i > 0) {
        const parentIndex = Math.floor((i - 1) / d)
        newEdges.push({ from: parentIndex, to: i })
      }
    }

    setNodes(newNodes)
    setEdges(newEdges)
  }

  const renderGraphviz = async () => {
    if (!dotSource || !graphvizInstance) return

    try {
      const svg = await graphvizInstance.layout(dotSource, "svg", "dot")
      setSvgString(svg)
    } catch (error) {
      console.error("Graphviz layout error:", error)
      toast({
        title: "Visualization Error",
        description: "Failed to generate the heap visualization",
        variant: "destructive",
      })
    }
  }

  const addOperationLog = (message: string) => {
    setOperationLog((prev) => [message, ...prev.slice(0, 9)])
  }

  const highlightNode = (index: number) => {
    setNodes((prev) =>
      prev.map((node, i) => ({
        ...node,
        highlighted: i === index,
      })),
    )
  }

  const performSwap = (index1: number, index2: number) => {
    setHeap((prev) => {
      const newHeap = [...prev]
      ;[newHeap[index1], newHeap[index2]] = [newHeap[index2], newHeap[index1]]
      return newHeap
    })
  }

  const insertValue = async () => {
    const value = Number.parseInt(inputValue)

    if (isNaN(value)) {
      toast({
        title: "Invalid input",
        description: "Please enter a valid number",
        variant: "destructive",
      })
      return
    }

    // Add the new value to the heap
    const newHeap = [...heap, value]
    setHeap(newHeap)
    addOperationLog(`Inserted value: ${value}`)

    // Heapify up
    const currentIndex = newHeap.length - 1
    await animateHeapifyUp(newHeap, currentIndex)

    setInputValue("")
  }

  const animateHeapifyUp = async (heapArray: number[], startIndex: number) => {
    let currentIndex = startIndex
    let parentIndex = Math.floor((currentIndex - 1) / d)

    while (currentIndex > 0) {
      parentIndex = Math.floor((currentIndex - 1) / d)

      // Highlight nodes being compared
      setHighlightedNodes([currentIndex, parentIndex])
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Check if we need to swap based on heap type
      const shouldSwap =
        heapType === "min"
          ? heapArray[currentIndex] < heapArray[parentIndex]
          : heapArray[currentIndex] > heapArray[parentIndex]

      if (shouldSwap) {
        // Swap values
        ;[heapArray[currentIndex], heapArray[parentIndex]] = [heapArray[parentIndex], heapArray[currentIndex]]
        setHeap([...heapArray])
        addOperationLog(`Swapped ${heapArray[parentIndex]} and ${heapArray[currentIndex]}`)

        // Move up
        currentIndex = parentIndex
        await new Promise((resolve) => setTimeout(resolve, 800))
      } else {
        break
      }
    }

    // Clear highlights
    setHighlightedNodes([])
  }

  const extractRoot = async () => {
    if (heap.length === 0) {
      toast({
        title: "Empty heap",
        description: "There are no elements to extract",
        variant: "destructive",
      })
      return
    }

    // Highlight the root that will be extracted
    setHighlightedNodes([0])
    await new Promise((resolve) => setTimeout(resolve, 800))

    const extractedValue = heap[0]
    addOperationLog(`Extracted ${heapType === "min" ? "minimum" : "maximum"} value: ${extractedValue}`)

    // If this is the last element, just remove it
    if (heap.length === 1) {
      setHeap([])
      setHighlightedNodes([])
      return
    }

    // Replace root with the last element and remove the last element
    const newHeap = [...heap]
    newHeap[0] = newHeap[newHeap.length - 1]
    newHeap.pop()
    setHeap(newHeap)

    // Highlight the new root
    setHighlightedNodes([0])
    await new Promise((resolve) => setTimeout(resolve, 800))

    // Heapify down
    await animateHeapifyDown(newHeap, 0)
  }

  const animateHeapifyDown = async (heapArray: number[], startIndex: number) => {
    let currentIndex = startIndex

    while (true) {
      let bestChildIndex = -1

      // Find the best child among d children
      for (let i = 1; i <= d; i++) {
        const childIndex = d * currentIndex + i

        if (childIndex < heapArray.length) {
          if (
            bestChildIndex === -1 ||
            (heapType === "min"
              ? heapArray[childIndex] < heapArray[bestChildIndex]
              : heapArray[childIndex] > heapArray[bestChildIndex])
          ) {
            bestChildIndex = childIndex
          }
        }
      }

      // If no children or heap property is satisfied
      if (
        bestChildIndex === -1 ||
        (heapType === "min"
          ? heapArray[currentIndex] <= heapArray[bestChildIndex]
          : heapArray[currentIndex] >= heapArray[bestChildIndex])
      ) {
        break
      }

      // Highlight nodes being compared
      setHighlightedNodes([currentIndex, bestChildIndex])
      await new Promise((resolve) => setTimeout(resolve, 800))

      // Swap with the best child
      ;[heapArray[currentIndex], heapArray[bestChildIndex]] = [heapArray[bestChildIndex], heapArray[currentIndex]]
      setHeap([...heapArray])
      addOperationLog(`Swapped ${heapArray[bestChildIndex]} and ${heapArray[currentIndex]}`)

      currentIndex = bestChildIndex
      await new Promise((resolve) => setTimeout(resolve, 800))
    }

    // Clear highlights
    setHighlightedNodes([])
  }

  const heapify = async () => {
    if (heap.length <= 1) return

    const newHeap = [...heap]
    addOperationLog("Starting heapify operation")

    // Start from the last non-leaf node and heapify down
    for (let i = Math.floor((newHeap.length - 2) / d); i >= 0; i--) {
      await animateHeapifyDown(newHeap, i)
    }

    addOperationLog("Heapify operation completed")
  }

  const clearHeap = () => {
    setHeap([])
    setHighlightedNodes([])
    setOperationLog([])
    addOperationLog("Heap cleared")
  }

  const generateRandomHeap = async () => {
    const size = Math.floor(Math.random() * 10) + 5 // 5-15 elements
    const randomHeap = Array.from({ length: size }, () => Math.floor(Math.random() * 100))
    setHeap(randomHeap)
    addOperationLog(`Generated random heap with ${size} elements`)

    // Trigger heapify animation
    setTimeout(async () => {
      await heapify()
    }, 800)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="d-value">Branching Factor (d): {d}</Label>
            <Slider
              id="d-value"
              min={2}
              max={5}
              step={1}
              value={[d]}
              onValueChange={(value) => setD(value[0])}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label>Heap Type</Label>
            <RadioGroup
              value={heapType}
              onValueChange={(value) => setHeapType(value as HeapType)}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="min" id="min-heap" />
                <Label htmlFor="min-heap">Min Heap</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="max" id="max-heap" />
                <Label htmlFor="max-heap">Max Heap</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex space-x-2">
            <div className="flex-1">
              <Input
                type="number"
                placeholder="Enter a value"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && insertValue()}
              />
            </div>
            <Button onClick={insertValue}>Insert</Button>
          </div>

          <div className="flex space-x-2">
            <Button onClick={extractRoot} variant="outline" className="flex-1">
              Extract {heapType === "min" ? "Min" : "Max"}
            </Button>
            <Button onClick={heapify} variant="outline" className="flex-1">
              Heapify
            </Button>
          </div>

          <div className="flex space-x-2">
            <Button onClick={generateRandomHeap} variant="secondary" className="flex-1">
              Random Heap
            </Button>
            <Button onClick={clearHeap} variant="destructive" className="flex-1">
              Clear
            </Button>
          </div>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">Heap Array</h3>
            <div className="flex flex-wrap gap-2">
              {heap.length > 0 ? (
                heap.map((value, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-center w-10 h-10 rounded-md border ${
                      highlightedNodes.includes(index) ? "bg-primary text-primary-foreground" : "bg-card"
                    }`}
                  >
                    {value}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Heap is empty</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">Information</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Total nodes: {heap.length}</li>
              {heap.length > 0 && (
                <>
                  <li>Root: {heap[0]}</li>
                  <li>Height: {Math.floor(Math.log(heap.length) / Math.log(d)) + 1}</li>
                </>
              )}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Tabs defaultValue="visualization">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="visualization">Graphviz</TabsTrigger>
              <TabsTrigger value="level-arrays">Level Arrays</TabsTrigger>
              <TabsTrigger value="dot">DOT Source</TabsTrigger>
            </TabsList>
            <TabsContent value="visualization" className="p-0">
              <Card className="p-4 min-h-[400px] flex items-center justify-center overflow-auto">
                {isGraphvizLoaded ? (
                  svgString ? (
                    <div
                      ref={svgContainerRef}
                      dangerouslySetInnerHTML={{ __html: svgString }}
                      className="w-full h-full flex items-center justify-center"
                    />
                  ) : (
                    <p className="text-muted-foreground">Add elements to visualize the heap</p>
                  )
                ) : (
                  <p className="text-muted-foreground">Loading Graphviz...</p>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="level-arrays" className="p-0">
              <Card className="p-4 min-h-[400px] overflow-auto">
                <h3 className="text-lg font-medium mb-4">Level-by-Level Array Representation</h3>
                {levelArrays.length > 0 ? (
                  <div className="space-y-6">
                    {levelArrays.map((level, levelIndex) => (
                      <div key={levelIndex} className="space-y-2">
                        <h4 className="text-sm font-medium">Level {levelIndex}</h4>
                        <div className="flex flex-wrap gap-4">
                          {level.map((element, elementIndex) => {
                            const globalIndex = (Math.pow(d, levelIndex) - 1) / (d - 1) + elementIndex
                            return (
                              <LevelArrayElement
                                key={elementIndex}
                                value={element.value}
                                parentValue={element.parentValue}
                                isHighlighted={element.isHighlighted}
                                index={globalIndex}
                                parentHighlighted={
                                  element.parentIndex !== null && highlightedNodes.includes(element.parentIndex)
                                }
                              />
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Add elements to visualize the heap levels</p>
                )}
              </Card>
            </TabsContent>
            <TabsContent value="dot" className="p-0">
              <Card className="p-4 min-h-[400px]">
                <pre className="text-xs overflow-auto h-[400px] font-mono">
                  {dotSource || "// No DOT source generated yet"}
                </pre>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="p-4">
            <h3 className="text-lg font-medium mb-2">Operation Log</h3>
            <div className="text-sm h-[200px] overflow-y-auto space-y-1">
              {operationLog.length > 0 ? (
                operationLog.map((log, index) => (
                  <div key={index} className="py-1 border-b last:border-0">
                    {log}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No operations performed yet</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <h3 className="text-lg font-medium mb-2">About D-ary Heap Level Arrays</h3>
        <p className="text-sm text-muted-foreground">
          The Level Arrays visualization shows each level of the heap as a separate array. Each element displays its own
          value and its parent's value above it with an arrow connecting them. This representation helps visualize how
          elements at each level relate to their parents, which is particularly useful for understanding the heap
          property and the parent-child relationships in a D-ary heap structure.
        </p>
      </Card>
    </div>
  )
}
