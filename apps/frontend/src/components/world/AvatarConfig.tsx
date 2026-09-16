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
      model: `${ASSET_BASE_URL}/avatars/male/Adventurer.fbx`,
    },
    {
      id: "male-astronaut",
      name: "Astronaut",
      model: `${ASSET_BASE_URL}/avatars/male/Spacesuit.fbx`,
    },
    {
      id: "male-beach",
      name: "Beach",
      model: `${ASSET_BASE_URL}/avatars/male/Beach.fbx`,
    },
    {
      id: "male-business",
      name: "Business Man",
      model: `${ASSET_BASE_URL}/avatars/male/Suit.fbx`,
    },
    {
      id: "male-casual",
      name: "Casual",
      model: `${ASSET_BASE_URL}/avatars/male/Casual_2.fbx`,
    },
    {
      id: "male-farmer",
      name: "Farmer",
      model: `${ASSET_BASE_URL}/avatars/male/Farmer.fbx`,
    },
    {
      id: "male-hoodie",
      name: "Hoodie",
      model: `${ASSET_BASE_URL}/avatars/male/Casual_Hoodie.fbx`,
    },
    {
      id: "male-king",
      name: "King",
      model: `${ASSET_BASE_URL}/avatars/male/King.fbx`,
    },
    {
      id: "male-punk",
      name: "Punk",
      model: `${ASSET_BASE_URL}/avatars/male/Punk.fbx`,
    },
    {
      id: "male-worker",
      name: "Worker",
      model: `${ASSET_BASE_URL}/avatars/male/Worker.fbx`,
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
