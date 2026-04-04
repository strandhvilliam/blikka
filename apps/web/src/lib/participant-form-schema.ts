import { z } from "zod";
import { isPossiblePhoneNumber } from "react-phone-number-input";

const baseParticipantSchema = z.object({
  reference: z.string(),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string(),
  competitionClassId: z.string(),
  deviceGroupId: z.string().min(1, "Select a device group"),
});

export type ParticipantFormSchemaOptions = {
  /** Staff laptop by-camera: reference may be empty until phone resolve (then server assigns random ref for new participants). */
  staffByCameraManual?: boolean
}

export function createParticipantFormSchema(
  marathonMode: string,
  options?: ParticipantFormSchemaOptions,
) {
  return baseParticipantSchema.superRefine((data, ctx) => {
    const ref = data.reference.trim()
    if (marathonMode === "marathon") {
      if (!/^\d{1,4}$/.test(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Participant reference must be 1-4 digits",
          path: ["reference"],
        })
      }
    } else if (marathonMode === "by-camera") {
      if (ref.length === 0 && !options?.staffByCameraManual) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Participant reference is required",
          path: ["reference"],
        })
      } else if (ref.length > 0 && !/^\d{1,4}$/.test(ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Participant reference must be 1-4 digits",
          path: ["reference"],
        })
      }
    }

    if (marathonMode === "by-camera") {
      if (!data.phone.trim()) {
        ctx.addIssue({
          code: "invalid_type",
          expected: "string",
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
        code: "invalid_type",
        expected: "string",
        message: "Select a competition class",
        path: ["competitionClassId"],
      });
    }
  });
}

export type ParticipantFormValues = z.infer<typeof baseParticipantSchema>;

