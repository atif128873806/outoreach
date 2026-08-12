export interface OnboardingSignals {
  emailVerified: boolean;
  senderProfileConfigured: boolean;
  contacts: number;
  previewed: boolean;
  postalConfigured: boolean;
  smtpTested: boolean;
  imapHealthy: boolean;
  realSent: number;
}

export type OnboardingStepId =
  | "verify_email"
  | "sender_profile"
  | "prospects"
  | "preview"
  | "postal_address"
  | "smtp_test"
  | "imap_test"
  | "pilot";

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  detail: string;
  href: string;
  action: string;
  done: boolean;
}

export interface OnboardingProgress {
  steps: OnboardingStep[];
  completedCount: number;
  totalSteps: number;
  progressPercent: number;
  next: OnboardingStep | null;
  complete: boolean;
}

/**
 * Ordered path from account creation to a safely launched ten-email pilot.
 * Later activity can satisfy earlier tracking added after launch, so existing
 * customers never get sent backwards through setup.
 */
export function getOnboardingProgress(signals: OnboardingSignals): OnboardingProgress {
  const contacts = Math.max(0, Math.floor(signals.contacts));
  const realSent = Math.max(0, Math.floor(signals.realSent));
  const steps: OnboardingStep[] = [
    {
      id: "verify_email",
      label: "Verify your email",
      detail: "Confirm your account address to unlock real sending and included AI.",
      href: "/dashboard#verify-email",
      action: "Verify email",
      done: signals.emailVerified,
    },
    {
      id: "sender_profile",
      label: "Describe your agency",
      detail: "Add your name, company and offer so messages sound like you.",
      href: "/settings#sender-identity",
      action: "Complete sender profile",
      done: signals.senderProfileConfigured,
    },
    {
      id: "prospects",
      label: "Add 10 qualified prospects",
      detail: `${Math.min(contacts, 10)}/10 ready — use Lead Finder or import a CSV.`,
      href: "/leads",
      action: "Find prospects",
      done: contacts >= 10,
    },
    {
      id: "preview",
      label: "Generate a sample campaign",
      detail: "See the message first in simulation mode; no mailbox is required.",
      href: "/campaigns",
      action: "Create a sample",
      done: signals.previewed,
    },
    {
      id: "postal_address",
      label: "Add your sender postal address",
      detail: "Required in the footer before any real commercial email is sent.",
      href: "/settings#sender-identity",
      action: "Add postal address",
      done: signals.postalConfigured,
    },
    {
      id: "smtp_test",
      label: "Test email delivery",
      detail: "Connect the sending mailbox and successfully deliver a test email.",
      href: "/settings#email-delivery",
      action: "Test SMTP delivery",
      done: signals.smtpTested || realSent > 0,
    },
    {
      id: "imap_test",
      label: "Verify reply detection",
      detail: "Confirm IMAP is healthy so replies and bounces stop future sends.",
      href: "/settings#reply-detection",
      action: "Test reply detection",
      done: signals.imapHealthy,
    },
    {
      id: "pilot",
      label: "Launch the 10-email pilot",
      detail: `${Math.min(realSent, 10)}/10 real emails sent safely.`,
      href: "/campaigns",
      action: "Launch test batch",
      done: realSent >= 10,
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;
  const totalSteps = steps.length;
  return {
    steps,
    completedCount,
    totalSteps,
    progressPercent: Math.round((completedCount / totalSteps) * 100),
    next: steps.find((step) => !step.done) ?? null,
    complete: completedCount === totalSteps,
  };
}
