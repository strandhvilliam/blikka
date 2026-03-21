import { Mail } from "lucide-react"

export default function JuryDefaultPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50 mb-4">
        <Mail className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <h2 className="text-base font-bold font-gothic mb-1">No Invitation Selected</h2>
      <p className="text-[13px] text-muted-foreground/70 max-w-[280px] text-center">
        Select an invitation from the list to view details, or create a new one to get started.
      </p>
    </div>
  )
}
