import { prisma } from "@hive/db";
import { DEFAULT_PRIVACY_SETTING } from "@hive/types";
import type {
  PrivacySettingRead,
  UpdatePrivacySettingInput,
} from "@hive/types";

export class PrivacyService {
  async get(workspaceId: string): Promise<PrivacySettingRead> {
    const row = await prisma.privacySetting.findUnique({
      where: { workspaceId },
    });
    if (!row) {
      return {
        workspaceId,
        ...DEFAULT_PRIVACY_SETTING,
        updatedById: null,
        updatedAt: null,
      };
    }
    return this.read(row);
  }

  async update(
    workspaceId: string,
    updatedById: string,
    input: UpdatePrivacySettingInput,
  ): Promise<PrivacySettingRead> {
    const row = await prisma.privacySetting.upsert({
      where: { workspaceId },
      create: { workspaceId, ...input, updatedById },
      update: { ...input, updatedById },
    });
    return this.read(row);
  }

  private read(row: {
    workspaceId: string;
    allowActivitySummaries: boolean;
    allowAgentStatus: boolean;
    allowTokenUsage: boolean;
    allowGitMetadata: boolean;
    allowExactCommands: boolean;
    allowFilePaths: boolean;
    allowPromptMetadata: boolean;
    updatedById: string | null;
    updatedAt: Date;
  }): PrivacySettingRead {
    return {
      workspaceId: row.workspaceId,
      allowActivitySummaries: row.allowActivitySummaries,
      allowAgentStatus: row.allowAgentStatus,
      allowTokenUsage: row.allowTokenUsage,
      allowGitMetadata: row.allowGitMetadata,
      allowExactCommands: row.allowExactCommands,
      allowFilePaths: row.allowFilePaths,
      allowPromptMetadata: row.allowPromptMetadata,
      updatedById: row.updatedById,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
