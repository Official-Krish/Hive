// src/components/world/avatarConfig.ts

import { ASSET_BASE_URL } from "../../lib/config";

export const AVATARS = {
  male: [
    {
      id: "avatar-01",
      name: "Retro Male 01",
      model: `${ASSET_BASE_URL}/avatars/male/hive_male_01.glb`,
    },
    {
      id: "avatar-02",
      name: "Retro Male 02",
      model: `${ASSET_BASE_URL}/avatars/male/hive_male_02.glb`,
    },
  ],
  female: [
    {
      id: "avatar-01",
      name: "Retro FeMale 01",
      model: `${ASSET_BASE_URL}/avatars/female/hive_female_01.glb`,
    },
    {
      id: "avatar-02",
      name: "Retro FeMale 02",
      model: `${ASSET_BASE_URL}/avatars/female/hive_female_02.glb`,
    },
  ],
} as const;
