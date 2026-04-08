"use client"

import { CheckIcon } from "lucide-react"
import { motion } from "motion/react"
import { BY_CAMERA_STEPS } from "@/lib/flow/constants"
import { cn } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { useStepState } from "@/lib/flow/step-state-context"

export function ByCameraStepNavigator() {
  const { step: currentStep, handleSetStep, maxSteps } = useStepState()
  const t = useTranslations("FlowPage")

  const getStepLabel = (step: number) => {
    switch (step) {
      case BY_CAMERA_STEPS.ParticipantDetailsStep:
        return t("steps.details")
      case BY_CAMERA_STEPS.DeviceSelectionStep:
        return t("steps.device")
      case BY_CAMERA_STEPS.UploadSubmissionStep:
        return t("steps.upload")
      default:
        return ""
    }
  }

  const isLastStep = (step: number) => step === maxSteps

  return (
    <nav className="mb-0">
      <ol className="flex items-center mx-auto max-w-3xl">
        {Object.values(BY_CAMERA_STEPS).map((step) => (
          <li
            key={step}
            className={cn("flex flex-col items-center", !isLastStep(step) && "flex-1")}
          >
            <div className="flex items-center w-full">
              <motion.button
                onClick={() => handleSetStep(step)}
                initial={false}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  scale: step <= currentStep ? 1 : 0.9,
                  backgroundColor:
                    step <= currentStep ? "hsl(240 5.9% 10%)" : "hsl(240 4.8% 95.9%)",
                  color: step <= currentStep ? "hsl(0 0% 98%)" : "hsl(240 3.8% 46.1%)",
                }}
                className={cn(
                  "flex items-center justify-center rounded-full shrink-0",
                  "w-8 h-8 sm:w-10 sm:h-10",
                  "hover:cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2",
                  "focus:ring-primary transition-shadow relative z-10 bg-background",
                  step <= currentStep ? "shadow-md" : "",
                )}
                transition={{ duration: 0.2 }}
              >
                {currentStep > step ? (
                  <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <span className="text-sm sm:text-base font-medium">{step}</span>
                )}
              </motion.button>
              {!isLastStep(step) && (
                <div className="flex-1 relative">
                  <motion.div
                    initial={false}
                    animate={{
                      backgroundColor:
                        step < currentStep ? "hsl(240 5.9% 8%)" : "hsl(240 4.8% 90%)",
                    }}
                    className="absolute inset-0 mx-2 h-0.5 top-1/2 -translate-y-1/2"
                    transition={{ duration: 0.2 }}
                  />
                </div>
              )}
            </div>
            <motion.span
              initial={{ opacity: 0, y: -10 }}
              animate={{
                opacity: step <= currentStep ? 1 : 0.5,
                y: 0,
              }}
              className={cn(
                "hidden sm:block text-xs sm:text-sm mt-2 font-medium truncate max-w-[110px] text-center",
                step <= currentStep ? "text-foreground" : "text-muted-foreground",
              )}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              {getStepLabel(step)}
            </motion.span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
