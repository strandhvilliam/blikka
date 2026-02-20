"use client"

import { useState } from "react"
import { useForm } from "@tanstack/react-form"
import { Plus, AlertTriangle, HardHat, Shield, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
import { useSession } from "@/lib/auth/client"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"

const roleTypes = [
  {
    value: "staff",
    label: "Staff",
    icon: HardHat,
  },
  {
    value: "admin",
    label: "Admin",
    icon: Shield,
  },
] as const

export function StaffAddDialog() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const [isOpen, setIsOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      role: "staff" as "staff" | "admin",
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null)
      addStaffMember({
        domain,
        data: {
          name: value.name,
          email: value.email,
          role: value.role,
        },
      })
    },
  })

  const { mutate: addStaffMember, isPending: isAddingStaffMember } = useMutation(
    trpc.users.createStaffMember.mutationOptions({
      onError: (error) => {
        console.error("Failed to add staff member:", error)
        setErrorMessage(error.message || "Failed to add staff member")
      },
      onSuccess: () => {
        toast.success("Staff member added successfully")
        setIsOpen(false)
        setErrorMessage(null)
        form.reset()
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.users.getStaffMembersByDomain.queryKey({ domain }),
        })
      },
    })
  )

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      setErrorMessage(null)
      form.reset()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <PrimaryButton>
          <Plus className="h-4 w-4" />
          <span className="hidden md:block text-sm">Add Staff</span>
        </PrimaryButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-gothic">Add Staff Member</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          {errorMessage && (
            <Alert variant="destructive" className="flex items-center gap-2 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="leading-none mt-1">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => (!value ? "Name is required" : undefined),
            }}
            children={(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Name
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Anna Johnson"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <em className="text-sm text-red-600">{field.state.meta.errors.join(", ")}</em>
                )}
              </div>
            )}
          />

          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                if (!value) return "Email is required"
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                  return "Invalid email address"
                }
                return undefined
              },
            }}
            children={(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Email
                </label>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="anna.johnson@example.com"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <em className="text-sm text-red-600">{field.state.meta.errors.join(", ")}</em>
                )}
              </div>
            )}
          />

          <form.Field
            name="role"
            validators={{
              onChange: ({ value }) => (!value ? "Role is required" : undefined),
            }}
            children={(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Role
                </label>
                <div className="flex gap-3 mt-2">
                  {roleTypes.map((role) => {
                    const Icon = role.icon
                    return (
                      <Button
                        key={role.value}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-40 w-40 p-0 relative overflow-hidden",
                          field.state.value === role.value && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => field.handleChange(role.value)}
                      >
                        <motion.div
                          animate={{
                            scale: field.state.value === role.value ? 1.1 : 1,
                          }}
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 20,
                          }}
                          className="flex flex-col items-center gap-2"
                        >
                          <Icon className="size-8" />
                          <span className="text-sm font-medium">{role.label}</span>
                        </motion.div>
                        <AnimatePresence>
                          {field.state.value === role.value && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.2 }}
                              className="absolute top-1 right-1 bg-primary rounded-full p-0.5"
                            >
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    )
                  })}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Select the role for this staff member.
                </p>
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                  <em className="text-sm text-red-600">{field.state.meta.errors.join(", ")}</em>
                )}
              </div>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isAddingStaffMember}
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isAddingStaffMember}>
              {isAddingStaffMember ? "Adding..." : "Add Staff Member"}
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
