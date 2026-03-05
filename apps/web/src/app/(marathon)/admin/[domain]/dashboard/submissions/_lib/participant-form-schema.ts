import { z } from "zod";
import { isPossiblePhoneNumber } from "react-phone-number-input";

type MarathonMode = "marathon" | "by-camera";

const referenceSchema = z
  .string()
  .trim()
  .regex(/^\d{1,4}$/, "Participant reference must be 1-4 digits")
  .transform((v) => v.padStart(4, "0"));

const baseParticipantSchema = z.object({
  reference: referenceSchema,
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string(),
  competitionClassId: z.string(),
  deviceGroupId: z.string().min(1, "Select a device group"),
});

export function createParticipantFormSchema(marathonMode: MarathonMode) {
  return baseParticipantSchema.superRefine((data, ctx) => {
    if (marathonMode === "by-camera") {
      if (!data.phone.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Phone number is required in by-camera mode",
          path: ["phone"],
        });
      } else if (!isPossiblePhoneNumber(data.phone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid phone number",
          path: ["phone"],
        });
      }
    }

    if (marathonMode === "marathon" && !data.competitionClassId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a competition class",
        path: ["competitionClassId"],
      });
    }
  });
}

export type ParticipantFormValues = z.infer<typeof baseParticipantSchema>;
