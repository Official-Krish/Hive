import { z } from "zod";

export const createConversationInputSchema = z.object({
  /** Workspace user ids. 1 other user = DM; 2+ = group (title required-ish). */
  memberIds: z.array(z.string().min(1)).min(1).max(20),
  title: z.string().trim().min(1).max(80).optional(),
});
export type CreateConversationInput = z.infer<
  typeof createConversationInputSchema
>;

export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  isGroup: boolean;
  members: Array<{
    userId: string;
    name: string;
    avatarUrl: string | null;
    status: string;
    label: string | null;
    workingOn: string | null;
  }>;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  updatedAt: string;
}
