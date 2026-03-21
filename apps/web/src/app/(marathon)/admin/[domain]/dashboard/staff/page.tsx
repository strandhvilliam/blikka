import { User2Icon } from "lucide-react"
import { StaffAccessCard } from "./_components/staff-access-card"

export default function StaffDefaultPage() {
  return (
    <div className="flex h-full flex-col px-8 py-8">
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted/50 mb-4">
          <User2Icon className="h-7 w-7 text-muted-foreground/40" />
        </div>
        <h2 className="mb-1.5 font-gothic text-lg font-semibold text-foreground">
          No Staff Selected
        </h2>
        <p className="max-w-md text-center text-[13px] leading-relaxed text-muted-foreground/70">
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
