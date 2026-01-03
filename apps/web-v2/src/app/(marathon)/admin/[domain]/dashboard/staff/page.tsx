import { User2Icon } from "lucide-react"

export default function StaffDefaultPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/30">
      <User2Icon className="h-16 w-16 mb-4 text-muted-foreground/40" />
      <h2 className="text-lg font-semibold mb-2 font-rocgrotesk">No Staff Selected</h2>
      <p className="text-sm text-muted-foreground/70">
        Select a staff member from the list to view their details
      </p>
    </div>
  )
}
