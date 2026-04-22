"use client"

import { useEffect, useState } from "react"
import { useForm } from "@tanstack/react-form"
import { AlertTriangle, HardHat, Shield, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
import { cn, formatDomainPathname } from "@/lib/utils"
import { motion, AnimatePresence } from "motion/react"
import { useRouter } from "next/navigation"

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

interface StaffEditDialogProps {
  accessId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialData: {
    name: string
    email: string
    role: "staff" | "admin"
  }
}

export function StaffEditDialog({
  accessId,
  isOpen,
  onOpenChange,
  initialData,
}: StaffEditDialogProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: initialData.name,
      email: initialData.email,
      role: initialData.role,
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null)
      updateStaffAccess({
        accessId,
        domain,
        data: {
          name: value.name,
          email: value.email,
          role: value.role,
        },
      })
    },
  })

  useEffect(() => {
    if (!isOpen) {
      return
    }

    form.setFieldValue("name", initialData.name)
    form.setFieldValue("email", initialData.email)
    form.setFieldValue("role", initialData.role)
  }, [form, initialData, isOpen])

  const { mutate: updateStaffAccess, isPending: isUpdatingStaffAccess } = useMutation(
    trpc.users.updateStaffAccess.mutationOptions({
      onError: (error) => {
        console.error("Failed to update staff access:", error)
        setErrorMessage(error.message || "Failed to update staff member")
      },
      onSuccess: (data) => {
        toast.success(
          data.kind === "pending"
            ? "Pending access updated successfully"
            : "Staff member updated successfully",
        )
        if (data.id !== accessId) {
          const base = formatDomainPathname("/admin/dashboard/staff", domain)
          router.replace(`${base}?access=${encodeURIComponent(data.id)}`)
        }
        onOpenChange(false)
        setErrorMessage(null)
      },
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.users.getStaffAccessById.queryKey({
            accessId,
            domain,
          }),
        })
        queryClient.invalidateQueries({
          queryKey: trpc.users.getStaffMembersByDomain.queryKey({ domain }),
        })
      },
    }),
  )

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setErrorMessage(null)
      form.reset()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-gothic">Edit Staff Member</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          {errorMessage ? (
            <Alert variant="destructive" className="flex items-center gap-2 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="mt-1 leading-none">{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => (!value ? "Name is required" : undefined),
            }}
          >
            {(field) => (
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
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Anna Johnson"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <em className="text-sm text-red-600">{field.state.meta.errors.join(", ")}</em>
                ) : null}
              </div>
            )}
          </form.Field>

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
          >
            {(field) => (
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
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="anna.johnson@example.com"
                />
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <em className="text-sm text-red-600">{field.state.meta.errors.join(", ")}</em>
                ) : null}
              </div>
            )}
          </form.Field>

          <form.Field
            name="role"
            validators={{
              onChange: ({ value }) => (!value ? "Role is required" : undefined),
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Role
                </label>
                <div className="mt-2 flex gap-3">
                  {roleTypes.map((role) => {
                    const Icon = role.icon
                    return (
                      <Button
                        key={role.value}
                        type="button"
                        variant="outline"
                        className={cn(
                          "relative h-40 w-40 overflow-hidden p-0",
                          field.state.value === role.value && "ring-2 ring-primary ring-offset-2",
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
                          {field.state.value === role.value ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ duration: 0.2 }}
                              className="absolute top-1 right-1 rounded-full bg-primary p-0.5"
                            >
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </Button>
                    )
                  })}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Staff can use the verification desk. Admins keep dashboard access and can also
                  use the staff page.
                </p>
                {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
                  <em className="text-sm text-red-600">{field.state.meta.errors.join(", ")}</em>
                ) : null}
              </div>
            )}
          </form.Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isUpdatingStaffAccess}>
              {isUpdatingStaffAccess ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
