import { z } from "zod";

export const privacySettingSchema = z.object({
  allowActivitySummaries: z.boolean(),
  allowAgentStatus: z.boolean(),
  allowTokenUsage: z.boolean(),
  allowGitMetadata: z.boolean(),
  allowExactCommands: z.boolean(),
  allowFilePaths: z.boolean(),
  allowPromptMetadata: z.boolean(),
});
export type PrivacySetting = z.infer<typeof privacySettingSchema>;

export const updatePrivacySettingSchema = privacySettingSchema.partial();
export type UpdatePrivacySettingInput = z.infer<
  typeof updatePrivacySettingSchema
>;

export interface PrivacySettingRead extends PrivacySetting {
  workspaceId: string;
  updatedById: string | null;
  updatedAt: string | null;
}

/** Matches the PrivacySetting model defaults when no row exists yet. */
export const DEFAULT_PRIVACY_SETTING: PrivacySetting = {
  allowActivitySummaries: true,
  allowAgentStatus: true,
  allowTokenUsage: true,
  allowGitMetadata: true,
  allowExactCommands: false,
  allowFilePaths: false,
  allowPromptMetadata: false,
};
