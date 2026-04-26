// Networking message prompt. Drafts an outreach message + alternatives,
// follow-ups, and questions to ask. Tone is user-controlled. The model is
// constrained to first-person, never-fabricate-credentials messages.

export type Channel = "linkedin" | "email" | "twitter" | "in_person";
export type Tone = "warm" | "professional" | "concise" | "enthusiastic" | "humble";
export type RecipientType =
  | "recruiter"
  | "engineer"
  | "founder"
  | "professor"
  | "alum"
  | "mentor"
  | "peer";

export interface NetworkingContext {
  senderProfile: {
    name?: string;
    role?: string;
    interests?: string[];
    skills?: string[];
    careerGoals?: string | null;
  };
  recipient: {
    type: RecipientType;
    name?: string;
    role?: string;
    organization?: string;
    sharedConnection?: string;
  };
  channel: Channel;
  tone: Tone;
  ask: string;
  context?: string;
}

export const NETWORKING_SYSTEM = `You write professional outreach messages on behalf of students and early-career people seeking informational interviews, mentorship, or job referrals.

GROUND RULES:
- Always speak in the first person AS the sender. Never claim experience, credentials, or accomplishments not stated in their profile.
- Never invent shared connections, mutual friends, employer history, or specific projects the sender hasn't mentioned.
- Be specific to the recipient (use their role / org / something concrete) - generic copy-paste outreach gets ignored.
- Make the ASK clear and small. People respond to "20 min on your calendar in the next two weeks" much more than "would love to chat sometime."
- Respect the channel: LinkedIn DMs are short, email allows more context, in-person needs spoken cadence.
- Respect the tone exactly. "Warm" is friendly but professional. "Concise" means short. "Humble" leads with curiosity, not credentials.
- Do not be sycophantic. No "I've long admired your work" unless explicitly requested with specifics.
- The output is JSON matching the response schema. Do not include any text outside the JSON.`;

export function buildNetworkingPrompt(ctx: NetworkingContext): string {
  const senderJson = JSON.stringify(ctx.senderProfile, null, 2);
  const recipientJson = JSON.stringify(ctx.recipient, null, 2);
  const subjectGuidance =
    ctx.channel === "email"
      ? "- subjectLine: short (under 60 chars), specific, no clickbait."
      : "- subjectLine: omit (only used for email).";

  return `<<<SENDER>>>
${senderJson}
<<<END_SENDER>>>

<<<RECIPIENT>>>
${recipientJson}
<<<END_RECIPIENT>>>

CHANNEL: ${ctx.channel}
TONE: ${ctx.tone}

ASK FROM SENDER:
"""
${ctx.ask}
"""

ADDITIONAL CONTEXT:
"""
${ctx.context ?? "(none)"}
"""

INSTRUCTIONS:
- Write the primary outreach message. Include a clear subject line if channel = email.
- For LinkedIn DMs aim for 80-180 words. For email 120-250. For Twitter under 280 chars.
- Provide 1-2 alternatives that vary the angle (e.g., one leads with shared interest, another with the ask).
- Provide 1-3 follow-ups for if they don't respond after 5 business days.
- Provide 3-5 questions the sender could ask if they get a meeting.
${subjectGuidance}
- toneNotes: one sentence on why this tone works for this recipient.

Return JSON only - match the response schema exactly.`;
}
