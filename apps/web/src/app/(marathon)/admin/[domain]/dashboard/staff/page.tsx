import { User2Icon } from "lucide-react"
import { StaffAccessCard } from "./_components/staff-access-card"

export default function StaffDefaultPage() {
  return (
    <div className="flex h-full flex-col gap-6 bg-muted/30 p-6">
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
        <User2Icon className="mb-4 h-16 w-16 text-muted-foreground/40" />
        <h2 className="mb-2 font-gothic text-lg font-semibold">No Staff Selected</h2>
        <p className="max-w-md text-center text-sm text-muted-foreground/70">
          Select a staff member from the list to view their details, or add a new staff member to
          give them access to the standalone verification desk.
        </p>
      </div>
      <div className="mx-auto w-full max-w-2xl">
        <StaffAccessCard />
      </div>
    </div>
  )
}
