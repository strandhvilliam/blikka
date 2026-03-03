"use client"

import { useState, useEffect } from "react"
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
import { PrimaryButton } from "@/components/ui/primary-button"
import { useTRPC } from "@/lib/trpc/client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useDomain } from "@/lib/domain-provider"
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

interface StaffEditDialogProps {
  staffId: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  initialData: {
    name: string
    email: string
    role: "staff" | "admin"
  }
}

export function StaffEditDialog({
  staffId,
  isOpen,
  onOpenChange,
  initialData,
}: StaffEditDialogProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const domain = useDomain()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const form = useForm({
    defaultValues: {
      name: initialData.name,
      email: initialData.email,
      role: initialData.role,
    },
    onSubmit: async ({ value }) => {
      setErrorMessage(null)
      updateStaffMember({
        staffId,
        domain,
        data: {
          name: value.name,
          email: value.email,
          role: value.role,
        },
      })
    },
  })

  // Update form values when initialData changes or dialog opens
  useEffect(() => {
    if (isOpen) {
      form.setFieldValue("name", initialData.name)
      form.setFieldValue("email", initialData.email)
      form.setFieldValue("role", initialData.role)
    }
  }, [initialData, isOpen, form])

  const { mutate: updateStaffMember, isPending: isUpdatingStaffMember } =
    useMutation(
      trpc.users.updateStaffMember.mutationOptions({
        onError: (error) => {
          console.error("Failed to update staff member:", error)
          setErrorMessage(error.message || "Failed to update staff member")
        },
        onSuccess: () => {
          toast.success("Staff member updated successfully")
          onOpenChange(false)
          setErrorMessage(null)
        },
        onSettled: () => {
          queryClient.invalidateQueries({
            queryKey: trpc.users.getStaffMemberById.queryKey({
              staffId,
              domain,
            }),
          })
          queryClient.invalidateQueries({
            queryKey: trpc.users.getStaffMembersByDomain.queryKey({ domain }),
          })
        },
      })
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
              <AlertDescription className="leading-none mt-1">
                {errorMessage}
              </AlertDescription>
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
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <em className="text-sm text-red-600">
                      {field.state.meta.errors.join(", ")}
                    </em>
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
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <em className="text-sm text-red-600">
                      {field.state.meta.errors.join(", ")}
                    </em>
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
                          field.state.value === role.value &&
                            "ring-2 ring-primary ring-offset-2"
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
                          <Icon className="h-12 w-12" />
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
                {field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0 && (
                    <em className="text-sm text-red-600">
                      {field.state.meta.errors.join(", ")}
                    </em>
                  )}
              </div>
            )}
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isUpdatingStaffMember}
            >
              Cancel
            </Button>
            <PrimaryButton type="submit" disabled={isUpdatingStaffMember}>
              {isUpdatingStaffMember ? "Updating..." : "Update Staff Member"}
            </PrimaryButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

