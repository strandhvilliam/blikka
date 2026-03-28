export {
  type OTPEmailParams,
  type ContactSheetEmailParams,
  type JuryInvitationEmailParams,
  type StaffInviteEmailParams,
  type MagicLinkEmailParams,
  type MarathonVerificationEmailParams,
  type VotingInviteEmailParams,
} from "./templates"

export { OTPEmail, otpEmailSubject, type OTPEmailProps } from "./templates/otp-email"
export {
  MagicLinkEmail,
  magicLinkEmailSubject,
  type MagicLinkEmailProps,
} from "./templates/magic-link-email"
export {
  MarathonVerificationEmail,
  marathonVerificationEmailSubject,
  type MarathonVerificationEmailProps,
} from "./templates/marathon-verification-email"
export {
  VotingInviteEmail,
  votingInviteEmailSubject,
  type VotingInviteEmailProps,
} from "./templates/voting-invite-email"

export { EmailService } from "./service"
