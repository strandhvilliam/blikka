import { Mail } from "lucide-react"

export default function JuryDefaultPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/30">
      <Mail className="h-16 w-16 mb-4 text-muted-foreground/40" />
      <h2 className="text-lg font-semibold mb-2 font-gothic">No Invitation Selected</h2>
      <p className="text-sm text-muted-foreground/70">
        Select an invitation from the list to view details, or create a new invitation to get
        started.
      </p>
    </div>
  )
}
