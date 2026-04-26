import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { networkingMessages } from "../db/schema";
import type { NetworkingMessageResponse } from "../services/ai/schemas";
import type { NetworkingContext } from "../services/ai/prompts/networking";

interface SaveInput {
  userId: string;
  ctx: NetworkingContext;
  ai: NetworkingMessageResponse;
}

export async function listForUser(userId: string, limit = 30) {
  return db
    .select()
    .from(networkingMessages)
    .where(eq(networkingMessages.userId, userId))
    .orderBy(desc(networkingMessages.createdAt))
    .limit(limit);
}

export async function getOne(userId: string, id: string) {
  const rows = await db
    .select()
    .from(networkingMessages)
    .where(and(eq(networkingMessages.userId, userId), eq(networkingMessages.id, id)))
    .limit(1);
  return rows[0] ?? null;
}

export async function save({ userId, ctx, ai }: SaveInput) {
  const [row] = await db
    .insert(networkingMessages)
    .values({
      userId,
      recipientType: ctx.recipient.type,
      messageType: ctx.channel === "email" ? "email" : "outreach",
      tone: ctx.tone,
      channel: ctx.channel,
      generatedMessage: ai.message,
      alternatives: ai.alternatives,
      followUps: ai.followUps,
      questions: ai.questions,
      context: {
        recipientName: ctx.recipient.name,
        recipientRole: ctx.recipient.role,
        sharedConnection: ctx.recipient.sharedConnection,
        askOrGoal: ctx.ask,
      },
    })
    .returning();
  return row;
}

export async function deleteOne(userId: string, id: string) {
  await db
    .delete(networkingMessages)
    .where(and(eq(networkingMessages.userId, userId), eq(networkingMessages.id, id)));
}
