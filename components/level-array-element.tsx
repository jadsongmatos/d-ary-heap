import { ArrowDown, ArrowDownLeft, ArrowDownRight } from "lucide-react"

interface LevelArrayElementProps {
  value: number | null
  parentValue: number | null
  isHighlighted: boolean
  index: number
  parentHighlighted: boolean
  isNull?: boolean
}

export function LevelArrayElement({
  value,
  parentValue,
  isHighlighted,
  index,
  parentHighlighted,
  isNull,
}: LevelArrayElementProps) {
  if (isNull || value === null) {
    return (
      <div className="flex flex-col items-center">
        {parentValue !== null && (
          <div className="flex flex-col items-center mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-md border border-dashed mb-1 bg-muted/30">
              —
            </div>
            <ArrowDown className="h-4 w-4 text-muted-foreground/30" />
          </div>
        )}
        <div className="flex items-center justify-center w-10 h-10 rounded-md border border-dashed bg-muted/30 text-muted-foreground">
          ∅
        </div>
        <div className="text-xs text-muted-foreground/50 mt-1">[{index}]</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {parentValue !== null && (
        <div className="flex flex-col items-center mb-1">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-md border mb-1 ${
              parentHighlighted ? "bg-primary text-primary-foreground" : "bg-muted/50"
            }`}
          >
            {parentValue}
          </div>
          <ArrowDown className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-md border ${
          isHighlighted ? "bg-primary text-primary-foreground" : "bg-card"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1">[{index}]</div>
    </div>
  )
}
