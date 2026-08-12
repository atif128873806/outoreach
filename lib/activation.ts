export interface ActivationSignals {
  verified: boolean;
  contacts: number;
  campaigns: number;
  generated: number;
  sentReal: number;
  replies: number;
  smtpConnected: boolean;
  imapConnected: boolean;
  postalConfigured: boolean;
}

export interface ActivationState {
  key:
    | "signed_up"
    | "verified"
    | "has_contacts"
    | "created_campaign"
    | "generated"
    | "sent_real"
    | "got_reply";
  label: string;
  step: number;
  totalSteps: number;
  progressPercent: number;
  nextAction: string;
  activated: boolean;
}

const TOTAL_STEPS = 7;

function state(
  key: ActivationState["key"],
  label: string,
  step: number,
  nextAction: string,
  activated = false
): ActivationState {
  return {
    key,
    label,
    step,
    totalSteps: TOTAL_STEPS,
    progressPercent: Math.round((step / TOTAL_STEPS) * 100),
    nextAction,
    activated,
  };
}

/**
 * Derives the furthest activation milestone a user has actually completed.
 *
 * These stages come from durable server-side records rather than page-view
 * events, so clearing cookies or blocking analytics cannot corrupt the funnel.
 */
export function getActivationState(signals: ActivationSignals): ActivationState {
  if (!signals.verified) {
    return state("signed_up", "Signed up", 1, "Verify email address");
  }
  if (signals.contacts <= 0) {
    return state("verified", "Email verified", 2, "Add the first qualified contacts");
  }
  if (signals.campaigns <= 0) {
    return state("has_contacts", "Contacts added", 3, "Create the first campaign");
  }
  if (signals.generated <= 0) {
    return state("created_campaign", "Campaign created", 4, "Generate the first messages");
  }
  if (signals.sentReal <= 0) {
    if (!signals.smtpConnected) {
      return state("generated", "Messages generated", 5, "Connect and test SMTP");
    }
    if (!signals.postalConfigured) {
      return state("generated", "Messages generated", 5, "Add the sender postal address");
    }
    return state("generated", "Messages generated", 5, "Approve and send the first real email");
  }
  if (signals.replies <= 0) {
    if (!signals.imapConnected) {
      return state("sent_real", "Real email sent", 6, "Connect IMAP to capture replies");
    }
    return state("sent_real", "Real email sent", 6, "Monitor replies and review the pilot");
  }
  return state(
    "got_reply",
    "Reply received",
    7,
    "Review the result and launch a second campaign",
    true
  );
}
