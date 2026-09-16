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
    {
      id: "male-adventure",
      name: "Adventure",
      model: `${ASSET_BASE_URL}/avatars/male/adventure.glb`,
    },
    {
      id: "male-astronaut",
      name: "Astronaut",
      model: `${ASSET_BASE_URL}/avatars/male/astronaut.glb`,
    },
    {
      id: "male-beach",
      name: "Beach",
      model: `${ASSET_BASE_URL}/avatars/male/beach.glb`,
    },
    {
      id: "male-business",
      name: "Business Man",
      model: `${ASSET_BASE_URL}/avatars/male/Buisness%20Man.glb`,
    },
    {
      id: "male-casual",
      name: "Casual",
      model: `${ASSET_BASE_URL}/avatars/male/casual.glb`,
    },
    {
      id: "male-farmer",
      name: "Farmer",
      model: `${ASSET_BASE_URL}/avatars/male/farmer.glb`,
    },
    {
      id: "male-hoodie",
      name: "Hoodie",
      model: `${ASSET_BASE_URL}/avatars/male/hoodie.glb`,
    },
    {
      id: "male-king",
      name: "King",
      model: `${ASSET_BASE_URL}/avatars/male/king.glb`,
    },
    {
      id: "male-punk",
      name: "Punk",
      model: `${ASSET_BASE_URL}/avatars/male/punk.glb`,
    },
    {
      id: "male-worker",
      name: "Worker",
      model: `${ASSET_BASE_URL}/avatars/male/worker.glb`,
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
