"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient as SupabaseClientType } from "@supabase/supabase-js";

type Role = "player" | "admin";

type Session = {
  email: string;
  role: Role;
  accountKey: string;
  userId?: string;
  isGuest: boolean;
};

type SpecialDialogue = {
  threshold: number;
  dialogue: string;
  imageUrl: string;
};

type TalkChoice = {
  text: string;
  response: string;
  affection: number;
};

type TalkEvent = {
  prompt: string;
  imageUrl: string;
  choices: TalkChoice[];
};

type GameCharacter = {
  id: string;
  name: string;
  personality: string;
  personalityTag: PersonalityTag;
  liftDialogue: string;
  sdImageUrl: string;
  talkImageUrl: string;
  dialogues: string[];
  specialDialogues: SpecialDialogue[];
  talkEvents: TalkEvent[];
};

type PersonalityTag = "balanced" | "active" | "shy" | "proud" | "foodie";

type GameContent = {
  backgroundUrl: string;
  characters: GameCharacter[];
};

type CharacterProgress = {
  level: number;
  exp: number;
  hunger: number;
  cleanliness: number;
  affection: number;
  coins: number;
  feedCharges: number;
  washCharges: number;
  feedRecoveredAt: string;
  washRecoveredAt: string;
  seenSpecialThresholds: number[];
};

type GameProgress = {
  characterId: string;
  characters: Record<string, CharacterProgress>;
  lastPlayed: string;
};

type PetPosition = {
  left: number;
  top: number;
};

type TouchReaction = {
  kind: "shake" | "jump" | "freeze";
  id: number;
} | null;

type DialogueState =
  | {
      kind: "normal" | "response";
      text: string;
      imageUrl?: string;
    }
  | {
      kind: "special";
      text: string;
      imageUrl?: string;
      revealImage: boolean;
    }
  | {
      kind: "choice";
      text: string;
      imageUrl?: string;
      event: TalkEvent;
    };

const contentStorageKey = "grow-game-content-v3";
const legacyContentStorageKey = "grow-game-content-v2";
const progressStoragePrefix = "grow-game-progress-v3";
const legacyProgressStoragePrefix = "grow-game-progress-v2";
const maxCareCharges = 5;
const careChargeRecoveryMs = 60 * 60 * 1000;
const specialThresholds = [20, 40, 60, 80, 100];
const personalityOptions: { value: PersonalityTag; label: string }[] = [
  { value: "balanced", label: "기본" },
  { value: "active", label: "활발함" },
  { value: "shy", label: "수줍음" },
  { value: "proud", label: "도도함" },
  { value: "foodie", label: "먹보" },
];

const defaultSpecialDialogues: SpecialDialogue[] = specialThresholds.map(
  (threshold) => ({
    threshold,
    dialogue: `호감도 ${threshold}%가 되었어. 앞으로도 곁에 있어줘!`,
    imageUrl: "",
  }),
);

const defaultTalkEvent: TalkEvent = {
  prompt: "갑자기 캐릭터가 조심스럽게 말을 걸어왔다. 뭐라고 답할까?",
  imageUrl: "",
  choices: [
    { text: "오늘도 귀엽다고 말한다", response: "정말? 그런 말 들으면 부끄러워.", affection: 8 },
    { text: "같이 산책하자고 한다", response: "좋아! 네가 같이 가주면 어디든 좋아.", affection: 6 },
    { text: "조금 놀려본다", response: "흥, 그래도 네가 싫지는 않아.", affection: 3 },
  ],
};

const defaultCharacter: GameCharacter = {
  id: "mongshil",
  name: "몽실이",
  personality: "호기심이 많고 칭찬에 약한 다정한 성격",
  personalityTag: "balanced",
  liftDialogue: "우와앗, 내려줘!",
  sdImageUrl: "",
  talkImageUrl: "",
  dialogues: [
    "오늘은 어떤 하루였어? 나는 네가 와줘서 기뻐.",
    "밥도 먹고 씻고 이야기하면 호감도가 쑥쑥 올라가!",
    "언젠가 더 멋진 모습으로 성장할 수 있을 것 같아.",
  ],
  specialDialogues: defaultSpecialDialogues,
  talkEvents: [defaultTalkEvent],
};

const defaultContent: GameContent = {
  backgroundUrl: "",
  characters: [defaultCharacter],
};

const defaultCharacterProgress: CharacterProgress = {
  level: 1,
  exp: 0,
  hunger: 70,
  cleanliness: 65,
  affection: 0,
  coins: 30,
  feedCharges: maxCareCharges,
  washCharges: maxCareCharges,
  feedRecoveredAt: new Date().toISOString(),
  washRecoveredAt: new Date().toISOString(),
  seenSpecialThresholds: [],
};

const emptyCharacter: GameCharacter = {
  id: "",
  name: "",
  personality: "",
  personalityTag: "balanced",
  liftDialogue: "내려줘!",
  sdImageUrl: "",
  talkImageUrl: "",
  dialogues: ["처음 만났네. 잘 부탁해!"],
  specialDialogues: defaultSpecialDialogues,
  talkEvents: [defaultTalkEvent],
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function progressKey(email: string) {
  return `${progressStoragePrefix}:${email.trim().toLowerCase()}`;
}

function hashText(value: string) {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function playerAccountKey(name: string, password: string) {
  return `${name.trim().toLowerCase()}:${hashText(password)}`;
}

function legacyProgressKey(email: string) {
  return `${legacyProgressStoragePrefix}:${email.trim().toLowerCase()}`;
}

function makeId(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `character-${Date.now()}`;
}

function uniqueId(baseId: string, characters: GameCharacter[]) {
  let candidate = baseId;
  let index = 2;
  const ids = new Set(characters.map((character) => character.id));

  while (ids.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}

function loadJson(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function sanitizeChoices(choices: unknown): TalkChoice[] {
  if (!Array.isArray(choices)) {
    return defaultTalkEvent.choices;
  }

  const sanitized = choices.slice(0, 3).map((choice, index) => {
    const item = choice as Partial<TalkChoice>;
    const fallback = defaultTalkEvent.choices[index];

    return {
      text: item.text?.trim() || fallback.text,
      response: item.response?.trim() || fallback.response,
      affection: Number.isFinite(item.affection)
        ? Number(item.affection)
        : fallback.affection,
    };
  });

  while (sanitized.length < 3) {
    sanitized.push(defaultTalkEvent.choices[sanitized.length]);
  }

  return sanitized;
}

function sanitizeTalkEvents(events: unknown): TalkEvent[] {
  if (!Array.isArray(events) || events.length === 0) {
    return [defaultTalkEvent];
  }

  return events.map((event) => {
    const item = event as Partial<TalkEvent>;

    return {
      prompt: item.prompt?.trim() || defaultTalkEvent.prompt,
      imageUrl: item.imageUrl?.trim() || "",
      choices: sanitizeChoices(item.choices),
    };
  });
}

function sanitizePersonalityTag(value: unknown): PersonalityTag {
  return personalityOptions.some((option) => option.value === value)
    ? (value as PersonalityTag)
    : "balanced";
}

function sanitizeSpecialDialogues(dialogues: unknown): SpecialDialogue[] {
  const savedItems = Array.isArray(dialogues) ? dialogues : [];

  return specialThresholds.map((threshold) => {
    const saved = savedItems.find(
      (item) => Number((item as Partial<SpecialDialogue>).threshold) === threshold,
    ) as Partial<SpecialDialogue> | undefined;
    const fallback = defaultSpecialDialogues.find(
      (item) => item.threshold === threshold,
    )!;

    return {
      threshold,
      dialogue: saved?.dialogue?.trim() || fallback.dialogue,
      imageUrl: saved?.imageUrl?.trim() || "",
    };
  });
}

function sanitizeCharacter(
  character: Partial<GameCharacter>,
  fallback: GameCharacter,
): GameCharacter {
  const dialogues = Array.isArray(character.dialogues)
    ? character.dialogues
        .map(String)
        .map((dialogue) => dialogue.trim())
        .filter(Boolean)
    : fallback.dialogues;

  return {
    id: character.id?.trim() || fallback.id,
    name: character.name?.trim() || fallback.name,
    personality: character.personality?.trim() || fallback.personality || "",
    personalityTag: sanitizePersonalityTag(
      character.personalityTag ?? fallback.personalityTag,
    ),
    liftDialogue:
      character.liftDialogue?.trim() || fallback.liftDialogue || "내려줘!",
    sdImageUrl: character.sdImageUrl?.trim() || "",
    talkImageUrl:
      character.talkImageUrl?.trim() || character.sdImageUrl?.trim() || "",
    dialogues: dialogues.length > 0 ? dialogues : fallback.dialogues,
    specialDialogues: sanitizeSpecialDialogues(character.specialDialogues),
    talkEvents: sanitizeTalkEvents(character.talkEvents),
  };
}

function loadGameContent(): GameContent {
  const savedContent = loadJson(contentStorageKey) as Partial<GameContent> | null;

  if (savedContent?.characters?.length) {
    return {
      backgroundUrl: savedContent.backgroundUrl?.trim() || "",
      characters: savedContent.characters.map((character, index) =>
        sanitizeCharacter(character, {
          ...defaultCharacter,
          id: `${defaultCharacter.id}-${index}`,
        }),
      ),
    };
  }

  const legacyContent = loadJson(legacyContentStorageKey) as
    | Partial<GameContent>
    | null;

  if (legacyContent?.characters?.length) {
    return {
      backgroundUrl: legacyContent.backgroundUrl?.trim() || "",
      characters: legacyContent.characters.map((character, index) =>
        sanitizeCharacter(character, {
          ...defaultCharacter,
          id: `${defaultCharacter.id}-${index}`,
        }),
      ),
    };
  }

  return defaultContent;
}

function rechargeCare(progress: CharacterProgress): CharacterProgress {
  const now = Date.now();

  function recharge(charges: number, recoveredAt: string) {
    if (charges >= maxCareCharges) {
      return {
        charges: maxCareCharges,
        recoveredAt: new Date(now).toISOString(),
      };
    }

    const last = new Date(recoveredAt).getTime();
    const elapsedHours = Math.max(
      0,
      Math.floor((now - last) / careChargeRecoveryMs),
    );
    const nextCharges = Math.min(maxCareCharges, charges + elapsedHours);
    const nextRecoveredAt =
      elapsedHours > 0
        ? new Date(last + elapsedHours * careChargeRecoveryMs).toISOString()
        : recoveredAt;

    return {
      charges: nextCharges,
      recoveredAt: nextCharges >= maxCareCharges ? new Date(now).toISOString() : nextRecoveredAt,
    };
  }

  const feed = recharge(progress.feedCharges, progress.feedRecoveredAt);
  const wash = recharge(progress.washCharges, progress.washRecoveredAt);

  return {
    ...progress,
    feedCharges: feed.charges,
    washCharges: wash.charges,
    feedRecoveredAt: feed.recoveredAt,
    washRecoveredAt: wash.recoveredAt,
  };
}

function sanitizeCharacterProgress(
  progress: Partial<CharacterProgress> | null | undefined,
): CharacterProgress {
  const now = new Date().toISOString();

  return rechargeCare({
    ...defaultCharacterProgress,
    ...progress,
    level: Math.max(1, progress?.level ?? defaultCharacterProgress.level),
    exp: Math.max(0, progress?.exp ?? defaultCharacterProgress.exp),
    hunger: clamp(progress?.hunger ?? defaultCharacterProgress.hunger),
    cleanliness: clamp(
      progress?.cleanliness ?? defaultCharacterProgress.cleanliness,
    ),
    affection: clamp(progress?.affection ?? defaultCharacterProgress.affection),
    coins: Math.max(0, progress?.coins ?? defaultCharacterProgress.coins),
    feedCharges: Math.min(
      maxCareCharges,
      Math.max(0, progress?.feedCharges ?? maxCareCharges),
    ),
    washCharges: Math.min(
      maxCareCharges,
      Math.max(0, progress?.washCharges ?? maxCareCharges),
    ),
    feedRecoveredAt: progress?.feedRecoveredAt ?? now,
    washRecoveredAt: progress?.washRecoveredAt ?? now,
    seenSpecialThresholds: Array.isArray(progress?.seenSpecialThresholds)
      ? progress.seenSpecialThresholds
      : [],
  });
}

function loadProgress(email: string, characters: GameCharacter[]): GameProgress {
  const savedProgress = loadJson(progressKey(email)) as Partial<GameProgress> | null;
  const fallbackCharacterId = characters[0]?.id ?? defaultCharacter.id;

  if (savedProgress?.characters) {
    const characterProgress = Object.fromEntries(
      characters.map((character) => [
        character.id,
        sanitizeCharacterProgress(savedProgress.characters?.[character.id]),
      ]),
    );
    const savedCharacterId =
      savedProgress.characterId &&
      characters.some((character) => character.id === savedProgress.characterId)
        ? savedProgress.characterId
        : fallbackCharacterId;

    return {
      characterId: savedCharacterId,
      characters: characterProgress,
      lastPlayed: savedProgress.lastPlayed ?? new Date().toISOString(),
    };
  }

  const legacyProgress = loadJson(legacyProgressKey(email)) as
    | {
        characterId?: string;
        level?: number;
        exp?: number;
        hunger?: number;
        cleanliness?: number;
        affection?: number;
        coins?: number;
        lastPlayed?: string;
      }
    | null;
  const legacyCharacterId =
    legacyProgress?.characterId &&
    characters.some((character) => character.id === legacyProgress.characterId)
      ? legacyProgress.characterId
      : fallbackCharacterId;

  return {
    characterId: legacyCharacterId,
    characters: Object.fromEntries(
      characters.map((character) => [
        character.id,
        sanitizeCharacterProgress(
          character.id === legacyCharacterId
            ? {
                level: legacyProgress?.level,
                exp: legacyProgress?.exp,
                hunger: legacyProgress?.hunger,
                cleanliness: legacyProgress?.cleanliness,
                affection: legacyProgress?.affection,
                coins: legacyProgress?.coins,
              }
            : null,
        ),
      ]),
    ),
    lastPlayed: legacyProgress?.lastPlayed ?? new Date().toISOString(),
  };
}

function getActiveProgress(
  progress: GameProgress,
  characterId: string,
): CharacterProgress {
  return rechargeCare(
    sanitizeCharacterProgress(progress.characters[characterId]),
  );
}

type SupabaseClient = SupabaseClientType;

const hasGameSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

async function loadSupabaseClient() {
  const { createSupabaseClient } = await import("@/lib/supabase");
  return createSupabaseClient();
}

function buildProgress(characters: GameCharacter[], selectedCharacterId?: string) {
  const fallbackCharacterId = characters[0]?.id ?? defaultCharacter.id;
  const characterId =
    selectedCharacterId &&
    characters.some((character) => character.id === selectedCharacterId)
      ? selectedCharacterId
      : fallbackCharacterId;

  return {
    characterId,
    characters: Object.fromEntries(
      characters.map((character) => [
        character.id,
        sanitizeCharacterProgress(null),
      ]),
    ),
    lastPlayed: new Date().toISOString(),
  };
}

function mapRemoteTalkEvent(row: Record<string, unknown>): TalkEvent {
  return {
    prompt: String(row.prompt ?? defaultTalkEvent.prompt),
    imageUrl: String(row.image_url ?? ""),
    choices: [
      {
        text: String(row.choice1_text ?? defaultTalkEvent.choices[0].text),
        response: String(
          row.choice1_response ?? defaultTalkEvent.choices[0].response,
        ),
        affection: Number(row.choice1_affection ?? defaultTalkEvent.choices[0].affection),
      },
      {
        text: String(row.choice2_text ?? defaultTalkEvent.choices[1].text),
        response: String(
          row.choice2_response ?? defaultTalkEvent.choices[1].response,
        ),
        affection: Number(row.choice2_affection ?? defaultTalkEvent.choices[1].affection),
      },
      {
        text: String(row.choice3_text ?? defaultTalkEvent.choices[2].text),
        response: String(
          row.choice3_response ?? defaultTalkEvent.choices[2].response,
        ),
        affection: Number(row.choice3_affection ?? defaultTalkEvent.choices[2].affection),
      },
    ],
  };
}

async function loadRemoteContent(supabase: SupabaseClient): Promise<GameContent> {
  const [contentResult, charactersResult, specialsResult, eventsResult] =
    await Promise.all([
      supabase
        .from("game_content")
        .select("background_url")
        .eq("id", "main")
        .maybeSingle(),
      supabase
        .from("game_characters")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("game_character_specials")
        .select("*")
        .order("threshold", { ascending: true }),
      supabase
        .from("game_character_talk_events")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

  if (charactersResult.error || !charactersResult.data?.length) {
    return loadGameContent();
  }

  const specialsByCharacter = new Map<string, SpecialDialogue[]>();
  for (const row of (specialsResult.data ?? []) as Record<string, unknown>[]) {
    const characterId = String(row.character_id ?? "");
    const items = specialsByCharacter.get(characterId) ?? [];
    items.push({
      threshold: Number(row.threshold),
      dialogue: String(row.dialogue ?? ""),
      imageUrl: String(row.image_url ?? ""),
    });
    specialsByCharacter.set(characterId, items);
  }

  const eventsByCharacter = new Map<string, TalkEvent[]>();
  for (const row of (eventsResult.data ?? []) as Record<string, unknown>[]) {
    const characterId = String(row.character_id ?? "");
    const items = eventsByCharacter.get(characterId) ?? [];
    items.push(mapRemoteTalkEvent(row));
    eventsByCharacter.set(characterId, items);
  }

  return {
    backgroundUrl: String(contentResult.data?.background_url ?? ""),
    characters: ((charactersResult.data ?? []) as Record<string, unknown>[]).map(
      (row, index) =>
        sanitizeCharacter(
          {
            id: String(row.id ?? ""),
            name: String(row.name ?? ""),
            personality: String(row.personality ?? ""),
            personalityTag: row.personality_tag as PersonalityTag,
            liftDialogue: String(row.lift_dialogue ?? ""),
            sdImageUrl: String(row.sd_image_url ?? ""),
            talkImageUrl: String(row.talk_image_url ?? ""),
            dialogues: Array.isArray(row.dialogues) ? row.dialogues : [],
            specialDialogues: specialsByCharacter.get(String(row.id ?? "")),
            talkEvents: eventsByCharacter.get(String(row.id ?? "")),
          },
          { ...defaultCharacter, id: `${defaultCharacter.id}-${index}` },
        ),
    ),
  };
}

async function saveRemoteContent(
  supabase: SupabaseClient,
  nextContent: GameContent,
) {
  const safeCharacters = nextContent.characters.length
    ? nextContent.characters.map((character, index) =>
        sanitizeCharacter(character, {
          ...defaultCharacter,
          id: `${defaultCharacter.id}-${index}`,
        }),
      )
    : [defaultCharacter];

  await supabase.from("game_content").upsert({
    id: "main",
    background_url: nextContent.backgroundUrl.trim(),
    updated_at: new Date().toISOString(),
  });

  const { data: existingCharacters } = await supabase
    .from("game_characters")
    .select("id");
  const nextCharacterIds = new Set(safeCharacters.map((character) => character.id));
  for (const existing of (existingCharacters ?? []) as { id: string }[]) {
    if (!nextCharacterIds.has(existing.id)) {
      await supabase.from("game_characters").delete().eq("id", existing.id);
    }
  }

  for (const [index, character] of safeCharacters.entries()) {
    await supabase.from("game_characters").upsert({
      id: character.id,
      name: character.name,
      personality: character.personality,
      personality_tag: character.personalityTag,
      lift_dialogue: character.liftDialogue,
      sd_image_url: character.sdImageUrl,
      talk_image_url: character.talkImageUrl,
      dialogues: character.dialogues,
      sort_order: index + 1,
      updated_at: new Date().toISOString(),
    });

    await supabase
      .from("game_character_specials")
      .delete()
      .eq("character_id", character.id);
    await supabase.from("game_character_specials").insert(
      character.specialDialogues.map((item) => ({
        character_id: character.id,
        threshold: item.threshold,
        dialogue: item.dialogue,
        image_url: item.imageUrl,
      })),
    );

    await supabase
      .from("game_character_talk_events")
      .delete()
      .eq("character_id", character.id);
    await supabase.from("game_character_talk_events").insert(
      character.talkEvents.map((event, eventIndex) => ({
        character_id: character.id,
        prompt: event.prompt,
        image_url: event.imageUrl,
        choice1_text: event.choices[0]?.text ?? "",
        choice1_response: event.choices[0]?.response ?? "",
        choice1_affection: event.choices[0]?.affection ?? 3,
        choice2_text: event.choices[1]?.text ?? "",
        choice2_response: event.choices[1]?.response ?? "",
        choice2_affection: event.choices[1]?.affection ?? 3,
        choice3_text: event.choices[2]?.text ?? "",
        choice3_response: event.choices[2]?.response ?? "",
        choice3_affection: event.choices[2]?.affection ?? 3,
        sort_order: eventIndex + 1,
      })),
    );
  }

  return {
    backgroundUrl: nextContent.backgroundUrl.trim(),
    characters: safeCharacters,
  };
}

async function loadRemoteProgress(
  supabase: SupabaseClient,
  userId: string,
  characters: GameCharacter[],
) {
  const [stateResult, progressResult] = await Promise.all([
    supabase
      .from("game_user_state")
      .select("selected_character_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("game_progress")
      .select("character_id, progress")
      .eq("user_id", userId),
  ]);
  const baseProgress = buildProgress(
    characters,
    String(stateResult.data?.selected_character_id ?? ""),
  );

  for (const row of (progressResult.data ?? []) as Record<string, unknown>[]) {
    const characterId = String(row.character_id ?? "");
    if (baseProgress.characters[characterId]) {
      baseProgress.characters[characterId] = sanitizeCharacterProgress(
        row.progress as Partial<CharacterProgress>,
      );
    }
  }

  return baseProgress;
}

async function saveRemoteProgress(
  supabase: SupabaseClient,
  userId: string,
  nextProgress: GameProgress,
) {
  await supabase
    .from("game_user_state")
    .upsert(
      {
        user_id: userId,
        selected_character_id: nextProgress.characterId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  await supabase.from("game_progress").upsert(
    Object.entries(nextProgress.characters).map(([characterId, characterProgress]) => ({
      user_id: userId,
      character_id: characterId,
      progress: characterProgress,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "user_id,character_id" },
  );
}

function getCrossedSpecialDialogue(
  character: GameCharacter,
  before: CharacterProgress,
  after: CharacterProgress,
) {
  const threshold = specialThresholds.find(
    (item) =>
      before.affection < item &&
      after.affection >= item &&
      !before.seenSpecialThresholds.includes(item),
  );

  if (!threshold) {
    return null;
  }

  return character.specialDialogues.find((item) => item.threshold === threshold) ?? null;
}

function careAffectionGain(tag: PersonalityTag, action: "feed" | "wash") {
  const baseGain = 3 + Math.floor(Math.random() * 3);

  if (tag === "foodie" && action === "feed") {
    return baseGain + 2;
  }

  if (tag === "proud" && baseGain > 3) {
    return baseGain - 1;
  }

  if (tag === "active" && action === "wash") {
    return baseGain + 1;
  }

  return baseGain;
}

function talkEventChance(tag: PersonalityTag) {
  return {
    balanced: 0.28,
    active: 0.38,
    shy: 0.2,
    proud: 0.24,
    foodie: 0.3,
  }[tag];
}

function pickTouchReaction(tag: PersonalityTag): NonNullable<TouchReaction>["kind"] {
  const reactionsByTag: Record<
    PersonalityTag,
    NonNullable<TouchReaction>["kind"][]
  > = {
    balanced: ["shake", "jump", "freeze"],
    active: ["jump", "jump", "shake", "freeze"],
    shy: ["freeze", "freeze", "shake", "jump"],
    proud: ["freeze", "shake", "shake", "jump"],
    foodie: ["jump", "shake", "shake", "freeze"],
  };
  const reactions = reactionsByTag[tag];

  return reactions[Math.floor(Math.random() * reactions.length)];
}

export function GrowGame() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const adminEmails = useMemo(
    () =>
      [
        process.env.NEXT_PUBLIC_GAME_ADMIN_EMAIL,
        process.env.NEXT_PUBLIC_ADMIN_EMAIL,
        "admin@game.local",
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase()),
    [],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<GameContent>(loadGameContent);
  const [progress, setProgress] = useState<GameProgress>(() =>
    loadProgress("guest", defaultContent.characters),
  );
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueState, setDialogueState] = useState<DialogueState | null>(null);
  const [petPosition, setPetPosition] = useState<PetPosition>({
    left: 45,
    top: 58,
  });
  const [touchReaction, setTouchReaction] = useState<TouchReaction>(null);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isCharacterHeld, setIsCharacterHeld] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const isAdmin = session?.role === "admin";
  const activeCharacter =
    content.characters.find(
      (character) => character.id === progress.characterId,
    ) ?? content.characters[0] ?? defaultCharacter;
  const activeProgress = getActiveProgress(progress, activeCharacter.id);
  const expGoal = activeProgress.level * 100;
  const expPercent = Math.round((activeProgress.exp / expGoal) * 100);
  const averageCare = Math.round(
    (activeProgress.hunger + activeProgress.cleanliness) / 2,
  );

  const stageBackground = content.backgroundUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.2), rgba(244,234,255,0.55)), url(${content.backgroundUrl})`,
      }
    : {
        backgroundImage:
          "radial-gradient(circle at 20% 18%, #fff9c7 0 8%, transparent 18%), linear-gradient(180deg, #bfefff 0%, #d8f7d0 58%, #a9de82 100%)",
      };

  const mood = useMemo(() => {
    const average =
      (activeProgress.hunger +
        activeProgress.cleanliness +
        activeProgress.affection) /
      3;
    if (average >= 80) {
      return "반짝반짝";
    }
    if (average >= 55) {
      return "기분 좋음";
    }
    if (average >= 30) {
      return "관심 필요";
    }
    return "삐짐";
  }, [
    activeProgress.affection,
    activeProgress.cleanliness,
    activeProgress.hunger,
  ]);

  useEffect(() => {
    if (!hasGameSupabaseEnv) {
      return;
    }

    let ignore = false;
    void loadSupabaseClient().then((client) => {
      if (!ignore) {
        setSupabase(client);
      }
    });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase;
    let ignore = false;

    async function initializeRemoteGame() {
      setIsLoading(true);
      const remoteContent = await loadRemoteContent(client);
      if (ignore) {
        return;
      }

      setContent(remoteContent);

      const { data } = await client.auth.getSession();
      const authUser = data.session?.user;
      if (!authUser || ignore) {
        setIsLoading(false);
        return;
      }

      const role = adminEmails.includes(authUser.email?.toLowerCase() ?? "")
        ? "admin"
        : "player";
      const remoteProgress = await loadRemoteProgress(
        client,
        authUser.id,
        remoteContent.characters,
      );

      if (!ignore) {
        setSession({
          email: authUser.email ?? "user",
          role,
          accountKey: authUser.id,
          userId: authUser.id,
          isGuest: false,
        });
        setProgress(remoteProgress);
        setIsLoading(false);
      }
    }

    void initializeRemoteGame();

    const { data: authListener } = client.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!nextSession?.user) {
          return;
        }
      },
    );

    return () => {
      ignore = true;
      authListener.subscription.unsubscribe();
    };
  }, [adminEmails, supabase]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (isCharacterHeld) {
        return;
      }

      setPetPosition({
        left: 14 + Math.random() * 64,
        top: 42 + Math.random() * 28,
      });
    }, 2800);

    return () => window.clearInterval(timer);
  }, [isCharacterHeld]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!session || isAdmin) {
      return;
    }

    if (session.isGuest || !session.userId || !supabase) {
      window.localStorage.setItem(
        progressKey(session.accountKey),
        JSON.stringify(progress),
      );
      return;
    }

    const timer = window.setTimeout(() => {
      void saveRemoteProgress(supabase, session.userId!, progress);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isAdmin, progress, session, supabase]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!supabase) {
      setLoginMessage("Supabase 설정이 없어 게스트 모드만 사용할 수 있습니다.");
      return;
    }

    if (!trimmedEmail || !password) {
      setLoginMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error || !data.user) {
      setIsLoading(false);
      setLoginMessage("로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
      return;
    }

    const role = adminEmails.includes(data.user.email?.toLowerCase() ?? "")
      ? "admin"
      : "player";
    const remoteContent = await loadRemoteContent(supabase);
    const remoteProgress = await loadRemoteProgress(
      supabase,
      data.user.id,
      remoteContent.characters,
    );

    setContent(remoteContent);
    setProgress(remoteProgress);
    setSession({
      email: data.user.email ?? trimmedEmail,
      role,
      accountKey: data.user.id,
      userId: data.user.id,
      isGuest: false,
    });
    setLoginMessage("");
    setDialogueState(null);
    setIsLoading(false);
  }

  async function signUp() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!supabase) {
      setLoginMessage("Supabase 설정이 없어 회원가입을 사용할 수 없습니다.");
      return;
    }

    if (!trimmedEmail || password.length < 6) {
      setLoginMessage("회원가입은 이메일과 6자 이상의 비밀번호가 필요합니다.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (error) {
      setIsLoading(false);
      setLoginMessage(`회원가입 실패: ${error.message}`);
      return;
    }

    if (!data.user || !data.session) {
      setIsLoading(false);
      setLoginMessage("가입 확인 메일을 확인해 주세요.");
      return;
    }

    const remoteContent = await loadRemoteContent(supabase);
    setContent(remoteContent);
    setProgress(buildProgress(remoteContent.characters));
    setSession({
      email: data.user.email ?? trimmedEmail,
      role: "player",
      accountKey: data.session.user.id,
      userId: data.session.user.id,
      isGuest: false,
    });
    setLoginMessage("");
    setDialogueState(null);
    setIsLoading(false);
  }

  function startGuest() {
    const guestName = email.trim() || "guest";
    const guestPassword = password || "guest";

    setSession({
      email: guestName,
      role: "player",
      accountKey: playerAccountKey(guestName, guestPassword),
      isGuest: true,
    });
    setProgress(
      loadProgress(playerAccountKey(guestName, guestPassword), content.characters),
    );
    setLoginMessage("");
    setDialogueState(null);
  }

  async function signOut() {
    if (session && !session.isGuest) {
      await supabase?.auth.signOut();
    }
    setSession(null);
    setPassword("");
    setLoginMessage("");
    setDialogueState(null);
  }

  async function saveContent(nextContent: GameContent) {
    const safeContent =
      supabase && session?.role === "admin" && !session.isGuest
        ? await saveRemoteContent(supabase, nextContent)
        : {
            backgroundUrl: nextContent.backgroundUrl.trim(),
            characters: nextContent.characters.length
              ? nextContent.characters.map((character, index) =>
                  sanitizeCharacter(character, {
                    ...defaultCharacter,
                    id: `${defaultCharacter.id}-${index}`,
                  }),
                )
              : [defaultCharacter],
          };

    setContent(safeContent);
    if (!supabase || session?.isGuest) {
      window.localStorage.setItem(contentStorageKey, JSON.stringify(safeContent));
    }

    setProgress((current) => {
      const characterProgress = Object.fromEntries(
        safeContent.characters.map((character) => [
          character.id,
          sanitizeCharacterProgress(current.characters[character.id]),
        ]),
      );

      return {
        ...current,
        characterId: safeContent.characters.some(
          (character) => character.id === current.characterId,
        )
          ? current.characterId
          : safeContent.characters[0].id,
        characters: characterProgress,
      };
    });
  }

  async function uploadGameImage(file: File) {
    if (!supabase || session?.role !== "admin" || session.isGuest) {
      return readImageFile(file);
    }

    if (!file.type.startsWith("image/")) {
      throw new Error("이미지 파일만 선택할 수 있습니다.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `game/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("game-images")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage.from("game-images").getPublicUrl(path);
    return data.publicUrl;
  }

  function chooseCharacter(characterId: string) {
    setProgress((current) => ({
      ...current,
      characterId,
      characters: {
        ...current.characters,
        [characterId]: sanitizeCharacterProgress(current.characters[characterId]),
      },
      lastPlayed: new Date().toISOString(),
    }));
    setDialogueIndex(0);
    setDialogueState(null);
    setIsGalleryOpen(false);
  }

  function updateActiveProgress(
    updater: (current: CharacterProgress) => CharacterProgress,
  ) {
    const before = activeProgress;
    const after = updater(before);
    const specialDialogue = getCrossedSpecialDialogue(
      activeCharacter,
      before,
      after,
    );
    const savedAfter = specialDialogue
      ? {
          ...after,
          seenSpecialThresholds: [
            ...after.seenSpecialThresholds,
            specialDialogue.threshold,
          ],
        }
      : after;

    setProgress((current) => {
      return {
        ...current,
        characters: {
          ...current.characters,
          [activeCharacter.id]: savedAfter,
        },
        lastPlayed: new Date().toISOString(),
      };
    });

    if (specialDialogue) {
      setDialogueState({
        kind: "special",
        text: specialDialogue.dialogue,
        imageUrl:
          specialDialogue.imageUrl ||
          activeCharacter.talkImageUrl ||
          activeCharacter.sdImageUrl,
        revealImage: false,
      });
    }

    return Boolean(specialDialogue);
  }

  function gainCare(action: "feed" | "wash") {
    if (dialogueState) {
      return;
    }

    const affectionGain = careAffectionGain(
      activeCharacter.personalityTag,
      action,
    );

    if (action === "feed" && activeProgress.feedCharges <= 0) {
      setDialogueState({
        kind: "normal",
        text: "밥주기 횟수가 부족해. 1시간마다 1회씩 회복돼!",
        imageUrl: activeCharacter.talkImageUrl || activeCharacter.sdImageUrl,
      });
      return;
    }

    if (action === "wash" && activeProgress.washCharges <= 0) {
      setDialogueState({
        kind: "normal",
        text: "씻기기 횟수가 부족해. 1시간마다 1회씩 회복돼!",
        imageUrl: activeCharacter.talkImageUrl || activeCharacter.sdImageUrl,
      });
      return;
    }

    updateActiveProgress((current) => {
      const nextExp = current.exp + (action === "feed" ? 14 : 12);
      const leveledUp = nextExp >= current.level * 100;

      return {
        ...current,
        level: leveledUp ? current.level + 1 : current.level,
        exp: leveledUp ? nextExp - current.level * 100 : nextExp,
        hunger: clamp(current.hunger + (action === "feed" ? 22 : -4)),
        cleanliness: clamp(
          current.cleanliness + (action === "wash" ? 24 : -5),
        ),
        affection: clamp(current.affection + affectionGain),
        coins: Math.max(0, current.coins + (action === "feed" ? -3 : 3)),
        feedCharges:
          action === "feed" ? Math.max(0, current.feedCharges - 1) : current.feedCharges,
        washCharges:
          action === "wash" ? Math.max(0, current.washCharges - 1) : current.washCharges,
      };
    });
  }

  function talkToCharacter() {
    if (dialogueState) {
      return;
    }

    const shouldShowEvent =
      activeCharacter.talkEvents.length > 0 &&
      Math.random() < talkEventChance(activeCharacter.personalityTag);

    if (shouldShowEvent) {
      const event =
        activeCharacter.talkEvents[
          Math.floor(Math.random() * activeCharacter.talkEvents.length)
        ];

      setDialogueState({
        kind: "choice",
        text: event.prompt,
        imageUrl:
          event.imageUrl || activeCharacter.talkImageUrl || activeCharacter.sdImageUrl,
        event,
      });
      return;
    }

    const showedSpecialDialogue = updateActiveProgress((current) => ({
      ...current,
      affection: clamp(current.affection + 2),
      exp: current.exp + 8,
    }));
    if (!showedSpecialDialogue) {
      setDialogueState({
        kind: "normal",
        text:
          activeCharacter.dialogues[dialogueIndex] ??
          activeCharacter.dialogues[0],
        imageUrl: activeCharacter.talkImageUrl || activeCharacter.sdImageUrl,
      });
    }
    setDialogueIndex(
      (current) => (current + 1) % activeCharacter.dialogues.length,
    );
  }

  function answerTalkEvent(choice: TalkChoice) {
    const showedSpecialDialogue = updateActiveProgress((current) => ({
      ...current,
      affection: clamp(current.affection + choice.affection),
      exp: current.exp + 18,
    }));
    if (!showedSpecialDialogue) {
      setDialogueState({
        kind: "response",
        text: choice.response,
        imageUrl: activeCharacter.talkImageUrl || activeCharacter.sdImageUrl,
      });
    }
  }

  function touchCharacter() {
    const nextReaction = pickTouchReaction(activeCharacter.personalityTag);

    setTouchReaction({
      kind: nextReaction,
      id: Date.now(),
    });
    window.setTimeout(() => setTouchReaction(null), 900);
  }

  function startHoldingCharacter() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }

    didLongPressRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      setIsCharacterHeld(true);
      setTouchReaction(null);
    }, 450);
  }

  function moveHeldCharacter(clientX: number, clientY: number) {
    if (!isCharacterHeld || !stageRef.current) {
      return;
    }

    const rect = stageRef.current.getBoundingClientRect();
    const left = clamp(((clientX - rect.left) / rect.width) * 100);
    const top = clamp(((clientY - rect.top) / rect.height) * 100);

    setPetPosition({
      left: Math.max(8, Math.min(92, left)),
      top: Math.max(18, Math.min(82, top)),
    });
  }

  function stopHoldingCharacter() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (didLongPressRef.current) {
      setIsCharacterHeld(false);
      didLongPressRef.current = false;
      return;
    }

    touchCharacter();
  }

  if (!session) {
    return (
      <main className="pastel-page min-h-screen px-5 py-8 text-[#3f2a56] sm:px-8">
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[2rem] bg-[#fffdf7]/90 p-6 shadow-sm ring-1 ring-pink-100 sm:p-10">
            <p className="text-sm font-bold text-[#9f7aea]">Growing Game</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-6xl">
              다마고치처럼 캐릭터를 키워보세요
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-[#6f5a7d]">
              캐릭터별 호감도와 돌봄 상태가 따로 저장됩니다. 밥주기,
              씻기기, 말걸기로 호감도를 올리고 특별 이벤트를 열어보세요.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <FeatureCard title="캐릭터별 저장" text="다른 캐릭터도 성장 유지" />
              <FeatureCard title="특별 대사" text="호감도 20%마다 이벤트" />
              <FeatureCard title="선택 이벤트" text="답변에 따라 호감도 변화" />
            </div>
          </div>

          <form
            onSubmit={signIn}
            className="rounded-[2rem] bg-white/80 p-6 shadow-sm ring-1 ring-pink-100 sm:p-8"
          >
            <h2 className="text-2xl font-bold">로그인하기</h2>
            <p className="mt-2 text-sm leading-6 text-[#7c658d]">
              이메일 계정으로 로그인하면 다른 기기에서도 같은 저장 데이터를
              불러올 수 있습니다. 게스트는 이 브라우저에만 저장됩니다.
            </p>
            <div className="mt-6 grid gap-3">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email@example.com"
                type="email"
                inputMode="email"
                className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호"
                type="password"
                className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
              />
              <button
                disabled={isLoading}
                className="rounded-2xl bg-[#b8a2ff] px-5 py-3 font-bold text-white transition hover:bg-[#9f7aea] disabled:opacity-60"
              >
                {isLoading ? "처리 중..." : "로그인하기"}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={() => void signUp()}
                className="rounded-2xl bg-[#c8f0ff] px-5 py-3 font-bold text-[#315267] transition hover:bg-[#a9e5fa] disabled:opacity-60"
              >
                회원가입
              </button>
              <button
                type="button"
                onClick={startGuest}
                className="rounded-2xl border border-pink-100 bg-white/70 px-5 py-3 font-bold text-[#6f5a7d] transition hover:bg-white"
              >
                게스트로 시작
              </button>
              {!hasGameSupabaseEnv ? (
                <p className="rounded-xl bg-[#fff7df] px-4 py-3 text-sm text-[#8a6a22]">
                  Supabase 환경변수가 없어 현재는 게스트 모드만 사용할 수
                  있습니다.
                </p>
              ) : null}
              {loginMessage ? (
                <p className="rounded-xl bg-[#fff0f5] px-4 py-3 text-sm text-[#9b3558]">
                  {loginMessage}
                </p>
              ) : null}
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="pastel-page min-h-screen px-5 py-8 text-[#3f2a56] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#9f7aea]">
              {isAdmin ? "Admin Mode" : "Tamagotchi Room"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              {isAdmin ? "게임 캐릭터 관리" : `${activeCharacter.name} 키우기`}
            </h1>
          </div>
          <button
            onClick={signOut}
            className="rounded-full bg-white/80 px-5 py-3 text-sm font-bold text-[#7c658d] ring-1 ring-pink-100"
          >
            로그아웃
          </button>
        </header>

        {isAdmin ? (
          <AdminGameEditor
            content={content}
            onSave={saveContent}
            uploadImage={uploadGameImage}
          />
        ) : (
          <section className="mt-8 grid gap-6">
            {content.characters.length > 1 ? (
              <CharacterSelector
                activeCharacterId={activeCharacter.id}
                characters={content.characters}
                progress={progress.characters}
                onChoose={chooseCharacter}
              />
            ) : null}

            <div className="relative overflow-hidden rounded-[2rem] bg-white/70 p-3 shadow-sm ring-1 ring-pink-100">
              <div
                ref={stageRef}
                className="relative min-h-[680px] overflow-hidden rounded-[1.5rem] bg-cover bg-center"
                style={stageBackground}
              >
                <AffinityGauge value={activeProgress.affection} />
                <button
                  onClick={() => setIsGalleryOpen(true)}
                  className="absolute right-5 top-28 z-10 rounded-full bg-[#2e2340]/90 px-5 py-3 text-sm font-bold text-white shadow-lg ring-2 ring-white/70 transition hover:bg-[#4b3868]"
                >
                  갤러리
                </button>
                <div className="absolute left-5 top-5 rounded-2xl bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-xs font-bold text-[#7c658d]">
                    Lv. {activeProgress.level} · {mood}
                  </p>
                  <p className="mt-1 text-sm font-bold text-[#3f2a56]">
                    코인 {activeProgress.coins} · 돌봄 {averageCare}%
                  </p>
                  <p className="mt-2 inline-flex rounded-full bg-[#e8dcff] px-3 py-1 text-xs font-bold text-[#6b4bb0]">
                    성격 태그:{" "}
                    {
                      personalityOptions.find(
                        (option) =>
                          option.value === activeCharacter.personalityTag,
                      )?.label
                    }
                  </p>
                  {activeCharacter.personality ? (
                    <p className="mt-2 max-w-64 text-xs leading-5 text-[#6f5a7d]">
                      {activeCharacter.personality}
                    </p>
                  ) : null}
                </div>

                <WalkingCharacter
                  character={activeCharacter}
                  position={petPosition}
                  reaction={touchReaction}
                  isHeld={isCharacterHeld}
                  onHoldStart={startHoldingCharacter}
                  onHoldEnd={stopHoldingCharacter}
                  onDragMove={moveHeldCharacter}
                />

                {dialogueState ? (
                  <DialogueBox
                    key={`${dialogueState.kind}-${dialogueState.text}`}
                    character={activeCharacter}
                    state={dialogueState}
                    onAnswer={answerTalkEvent}
                    onSkip={() => setDialogueState(null)}
                  />
                ) : null}

                {isGalleryOpen ? (
                  <GalleryModal
                    character={activeCharacter}
                    progress={activeProgress}
                    onClose={() => setIsGalleryOpen(false)}
                  />
                ) : null}

                <div className="absolute inset-x-4 bottom-4 grid gap-3 rounded-[1.5rem] bg-white/85 p-4 shadow-lg backdrop-blur sm:grid-cols-3">
                  <GameActionButton
                    title="밥주기"
                    text={`남은 횟수 ${activeProgress.feedCharges}/${maxCareCharges}`}
                    disabled={Boolean(dialogueState)}
                    onClick={() => gainCare("feed")}
                  />
                  <GameActionButton
                    title="씻기기"
                    text={`남은 횟수 ${activeProgress.washCharges}/${maxCareCharges}`}
                    disabled={Boolean(dialogueState)}
                    onClick={() => gainCare("wash")}
                  />
                  <GameActionButton
                    title="말걸기"
                    text="일반 대화 또는 선택 이벤트"
                    disabled={Boolean(dialogueState)}
                    onClick={talkToCharacter}
                  />
                </div>
              </div>
            </div>

            <section className="grid gap-4 rounded-[2rem] bg-[#fffdf7]/90 p-6 shadow-sm ring-1 ring-pink-100 sm:grid-cols-3">
              <StatBar label="경험치" value={expPercent} detail={`${activeProgress.exp}/${expGoal}`} />
              <StatBar label="포만감" value={activeProgress.hunger} />
              <StatBar label="청결도" value={activeProgress.cleanliness} />
            </section>
          </section>
        )}
      </div>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-pink-100">
      <h3 className="font-bold">{title}</h3>
      <p className="mt-1 text-sm text-[#7c658d]">{text}</p>
    </div>
  );
}

function CharacterSelector({
  activeCharacterId,
  characters,
  progress,
  onChoose,
}: {
  activeCharacterId: string;
  characters: GameCharacter[];
  progress: Record<string, CharacterProgress>;
  onChoose: (characterId: string) => void;
}) {
  return (
    <section className="flex gap-3 overflow-x-auto rounded-[2rem] bg-white/70 p-4 shadow-sm ring-1 ring-pink-100">
      {characters.map((character) => {
        const characterProgress = sanitizeCharacterProgress(progress[character.id]);

        return (
          <button
            key={character.id}
            onClick={() => onChoose(character.id)}
            className={`min-w-44 rounded-2xl px-4 py-3 text-left text-sm font-bold ring-1 transition ${
              character.id === activeCharacterId
                ? "bg-[#b8a2ff] text-white ring-[#9f7aea]"
                : "bg-[#fffdf7] text-[#6f5a7d] ring-pink-100"
            }`}
          >
            <span className="block">{character.name}</span>
            <span className="mt-1 block text-xs opacity-80">
              호감도 {characterProgress.affection}%
            </span>
          </button>
        );
      })}
    </section>
  );
}

function WalkingCharacter({
  character,
  position,
  reaction,
  isHeld,
  onHoldStart,
  onHoldEnd,
  onDragMove,
}: {
  character: GameCharacter;
  position: PetPosition;
  reaction: TouchReaction;
  isHeld: boolean;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onDragMove: (clientX: number, clientY: number) => void;
}) {
  const reactionClass = reaction ? `pet-reaction-${reaction.kind}` : "";
  const heldClass = isHeld ? "pet-held-wiggle" : "";
  const reactionLabel = {
    shake: "부르르!",
    jump: "뾱!",
    freeze: "얼음!",
  }[reaction?.kind ?? "shake"];

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onHoldStart();
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onHoldEnd();
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        onHoldEnd();
      }}
      onPointerMove={(event) => {
        onDragMove(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onHoldStart();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onHoldEnd();
        }
      }}
      aria-label={`${character.name} 터치하기`}
      className={`absolute flex h-36 w-36 cursor-pointer touch-manipulation items-center justify-center rounded-full ease-in-out focus:outline-none focus:ring-4 focus:ring-white/70 sm:h-44 sm:w-44 ${
        isHeld ? "transition-transform duration-75" : "transition-all duration-1000"
      }`}
      style={{
        left: `${position.left}%`,
        top: `${position.top}%`,
        transform: isHeld
          ? "translate(-50%, calc(-50% - 70px))"
          : "translate(-50%, -50%)",
      }}
    >
      <style>{`
        @keyframes pet-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          20% { transform: translateX(-8px) rotate(-5deg); }
          40% { transform: translateX(8px) rotate(5deg); }
          60% { transform: translateX(-6px) rotate(-4deg); }
          80% { transform: translateX(6px) rotate(4deg); }
        }
        @keyframes pet-pop-jump {
          0%, 100% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-36px) scale(1.08); }
          62% { transform: translateY(4px) scale(0.96); }
        }
        @keyframes pet-freeze {
          0% { transform: scale(1); filter: none; }
          20%, 80% { transform: scale(0.92); filter: grayscale(1) brightness(1.25); }
          100% { transform: scale(1); filter: none; }
        }
        @keyframes pet-slime-walk {
          0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
          20% { transform: scaleX(1.08) scaleY(0.9) translateY(7px); }
          45% { transform: scaleX(0.94) scaleY(1.1) translateY(-6px); }
          70% { transform: scaleX(1.04) scaleY(0.96) translateY(3px); }
        }
        @keyframes pet-held-wiggle {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-13px) rotate(-7deg); }
          50% { transform: translateX(10px) rotate(6deg); }
          75% { transform: translateX(-7px) rotate(-4deg); }
        }
        .pet-reaction-shake { animation: pet-shake 0.55s ease-in-out; }
        .pet-reaction-jump { animation: pet-pop-jump 0.7s ease-out; }
        .pet-reaction-freeze { animation: pet-freeze 0.85s ease-in-out; }
        .pet-held-wiggle { animation: pet-held-wiggle 0.42s ease-in-out infinite; }
        .pet-slime-body {
          animation: pet-slime-walk 1.05s ease-in-out infinite;
          transform-origin: 50% 92%;
        }
      `}</style>
      {reaction ? (
        <span className="absolute -top-7 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#6b4bb0] shadow-sm">
          {reactionLabel}
        </span>
      ) : null}
      {isHeld ? (
        <span className="absolute -top-16 min-w-32 rounded-2xl bg-white/95 px-4 py-2 text-sm font-bold text-[#6b4bb0] shadow-lg ring-1 ring-pink-100">
          {character.liftDialogue}
        </span>
      ) : null}
      <span
        key={reaction?.id ?? "idle"}
        className={`flex h-full w-full items-center justify-center ${reactionClass} ${heldClass}`}
      >
        <span className="pet-slime-body flex h-full w-full items-center justify-center">
          {character.sdImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.sdImageUrl}
              alt={`${character.name} SD 이미지`}
              draggable={false}
              onDragStart={(event) => event.preventDefault()}
              className="pointer-events-none h-full w-full select-none object-contain drop-shadow-2xl"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-full bg-[#fffdf7]/90 text-7xl shadow-xl ring-4 ring-white/60">
              🐾
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function AffinityGauge({ value }: { value: number }) {
  return (
    <div className="absolute right-5 top-5 z-10 w-56 rounded-2xl bg-white/85 p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm font-bold text-[#7d4058]">
        <span>호감도</span>
        <span>♥ {value}%</span>
      </div>
      <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#ffe8f0]">
        <div
          className="h-full rounded-full bg-[#ff7aa8] transition-all"
          style={{ width: `${clamp(value)}%` }}
        />
      </div>
    </div>
  );
}

function GalleryModal({
  character,
  progress,
  onClose,
}: {
  character: GameCharacter;
  progress: CharacterProgress;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-4 z-30 overflow-hidden rounded-[1.5rem] bg-[#21192f]/95 text-white shadow-2xl ring-2 ring-white/70">
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-bold tracking-[0.3em] text-[#ffd9e7]">
              MEMORY GALLERY
            </p>
            <h2 className="mt-1 text-2xl font-bold">
              {character.name} 갤러리
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/20 px-4 py-2 text-xs font-bold"
          >
            닫기
          </button>
        </header>
        <div className="grid flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2 lg:grid-cols-3">
          {character.specialDialogues.map((item) => {
            const unlocked = progress.seenSpecialThresholds.includes(
              item.threshold,
            );

            return (
              <article
                key={item.threshold}
                className={`overflow-hidden rounded-2xl ring-1 ${
                  unlocked
                    ? "bg-white/12 ring-white/20"
                    : "bg-black/25 ring-white/10"
                }`}
              >
                <div className="flex h-48 items-center justify-center bg-white/10 p-3">
                  {unlocked ? (
                    item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={`${character.name} 호감도 ${item.threshold}% 갤러리 이미지`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-6xl">🐾</span>
                    )
                  ) : (
                    <div className="text-center">
                      <div className="text-6xl">🔒</div>
                      <p className="mt-3 text-sm font-bold text-white/80">
                        아직 못 얻은 이미지
                      </p>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-sm font-bold text-[#ffd9e7]">
                    호감도 {item.threshold}%
                  </p>
                  {unlocked ? (
                    <p className="mt-2 text-sm leading-6 text-white/80">
                      {item.dialogue}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-white/70">
                      호감도를 더 높이면 얻을 수 있어요!
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DialogueBox({
  character,
  state,
  onAnswer,
  onSkip,
}: {
  character: GameCharacter;
  state: DialogueState;
  onAnswer: (choice: TalkChoice) => void;
  onSkip: () => void;
}) {
  const imageUrl = state.imageUrl || character.talkImageUrl || character.sdImageUrl;
  const [typedText, setTypedText] = useState(
    state.kind === "special" ? "" : state.text,
  );
  const [showSpecialImage, setShowSpecialImage] = useState(false);

  useEffect(() => {
    if (state.kind !== "special") {
      return;
    }

    let index = 0;
    let revealTimer: number | undefined;
    const typingTimer = window.setInterval(() => {
      index += 1;
      setTypedText(state.text.slice(0, index));

      if (index >= state.text.length) {
        window.clearInterval(typingTimer);
        revealTimer = window.setTimeout(() => {
          setShowSpecialImage(true);
        }, 700);
      }
    }, 45);

    return () => {
      window.clearInterval(typingTimer);
      if (revealTimer) {
        window.clearTimeout(revealTimer);
      }
    };
  }, [state.kind, state.text]);

  function advanceDialogue() {
    if (state.kind === "choice") {
      return;
    }

    if (state.kind === "special") {
      setShowSpecialImage(true);
      return;
    }

    onSkip();
  }

  if (state.kind === "special" && showSpecialImage) {
    return (
      <div
        onClick={onSkip}
        className="absolute inset-4 z-20 overflow-hidden rounded-[1.5rem] bg-[#21192f]/95 text-white shadow-2xl ring-2 ring-white/70"
      >
        <style>{`
          @keyframes special-memory-in {
            0% { opacity: 0; transform: scale(0.92) translateY(18px); filter: blur(10px); }
            70% { opacity: 1; transform: scale(1.02) translateY(0); filter: blur(0); }
            100% { opacity: 1; transform: scale(1); filter: blur(0); }
          }
          .special-memory-card { animation: special-memory-in 0.75s ease-out both; }
        `}</style>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onSkip();
          }}
          className="absolute right-4 top-4 z-50 rounded-full bg-white/25 px-4 py-2 text-xs font-bold tracking-wide shadow-lg"
        >
          SKIP
        </button>
        <div className="grid h-full place-items-center p-6">
          <div className="special-memory-card w-full max-w-3xl text-center">
            <p className="text-sm font-bold tracking-[0.3em] text-[#ffd9e7]">
              SPECIAL MEMORY
            </p>
            <h2 className="mt-3 text-3xl font-bold">{character.name}</h2>
            <div className="mt-6 flex min-h-80 items-center justify-center rounded-[1.5rem] bg-white/10 p-4">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={`${character.name} 특별 이벤트 이미지`}
                  className="max-h-[420px] w-full object-contain"
                />
              ) : (
                <div className="text-8xl">🐾</div>
              )}
            </div>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSkip();
              }}
              className="mt-6 rounded-full bg-[#ffd9e7] px-6 py-3 text-sm font-bold text-[#5b2d45]"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={advanceDialogue}
      className="absolute inset-x-4 bottom-32 z-20 grid min-h-52 cursor-pointer grid-cols-[1fr_120px] overflow-hidden rounded-[1.5rem] bg-[#2e2340]/92 text-white shadow-2xl ring-2 ring-white/70 sm:grid-cols-[1fr_190px]"
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          onSkip();
        }}
        className="absolute right-4 top-4 z-50 rounded-full bg-white/25 px-4 py-2 text-xs font-bold tracking-wide shadow-lg"
      >
        SKIP
      </button>
      <div className="p-5 pr-20 sm:p-6 sm:pr-24">
        <h2 className="text-xl font-bold text-[#ffd9e7]">{character.name}</h2>
        <p className="mt-4 min-h-16 text-lg leading-8">
          {state.kind === "special" ? typedText : state.text}
          {state.kind === "special" && typedText.length < state.text.length ? (
            <span className="ml-1 animate-pulse">|</span>
          ) : null}
        </p>
        {state.kind === "choice" ? (
          <div className="mt-5 grid gap-2">
            {state.event.choices.map((choice) => (
              <button
                key={`${choice.text}-${choice.response}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onAnswer(choice);
                }}
                className="rounded-2xl bg-white/15 px-4 py-3 text-left text-sm font-bold transition hover:bg-white/25"
              >
                {choice.text}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-end justify-center bg-white/10 p-2">
        {state.kind === "special" ? (
          <div className="mb-4 rounded-2xl bg-white/15 px-4 py-3 text-center text-sm font-bold text-[#ffd9e7]">
            이미지 공개 전
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${character.name} 대화 이미지`}
            className="max-h-52 w-full object-contain"
          />
        ) : (
          <div className="mb-4 text-6xl">🐾</div>
        )}
      </div>
    </div>
  );
}

function StatBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm font-bold text-[#6f5a7d]">
        <span>{label}</span>
        <span>{detail ?? `${value}%`}</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#efe7ff]">
        <div
          className="h-full rounded-full bg-[#b8a2ff] transition-all"
          style={{ width: `${clamp(value)}%` }}
        />
      </div>
    </div>
  );
}

function GameActionButton({
  title,
  text,
  disabled = false,
  onClick,
}: {
  title: string;
  text: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl bg-[#fffdf7] p-4 text-left shadow-sm ring-1 ring-pink-100 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-sm"
    >
      <span className="block text-lg font-bold">{title}</span>
      <span className="mt-1 block text-sm leading-6 text-[#7c658d]">{text}</span>
    </button>
  );
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 선택할 수 있습니다."));
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      reject(new Error("이미지는 1.5MB 이하로 선택해 주세요."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function ImageFileField({
  label,
  onUpload,
  uploadFile,
}: {
  label: string;
  onUpload: (imageUrl: string) => void;
  uploadFile?: (file: File) => Promise<string>;
}) {
  const [message, setMessage] = useState("");

  async function handleFile(file: File) {
    try {
      const imageUrl = uploadFile
        ? await uploadFile(file)
        : await readImageFile(file);
      onUpload(imageUrl);
      setMessage("이미지를 불러왔습니다. 전체 설정 저장을 눌러 반영하세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "업로드에 실패했습니다.");
    }
  }

  return (
    <label className="grid gap-2 rounded-2xl border border-dashed border-pink-200 bg-white/60 p-3 text-sm font-bold text-[#6f5a7d]">
      {label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
          event.target.value = "";
        }}
        className="block w-full text-sm text-[#7c658d] file:mr-4 file:rounded-full file:border-0 file:bg-[#b8a2ff] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
      />
      {message ? <span className="text-xs font-normal">{message}</span> : null}
    </label>
  );
}

function AdminGameEditor({
  content,
  onSave,
  uploadImage,
}: {
  content: GameContent;
  onSave: (content: GameContent) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
}) {
  const [draft, setDraft] = useState<GameContent>(() => ({
    backgroundUrl: content.backgroundUrl,
    characters: content.characters.map((character) => ({ ...character })),
  }));
  const [newCharacter, setNewCharacter] =
    useState<GameCharacter>(emptyCharacter);
  const [message, setMessage] = useState("");

  function updateCharacter(characterId: string, nextCharacter: GameCharacter) {
    setDraft((current) => ({
      ...current,
      characters: current.characters.map((character) =>
        character.id === characterId ? nextCharacter : character,
      ),
    }));
  }

  function removeCharacter(characterId: string) {
    setDraft((current) => ({
      ...current,
      characters:
        current.characters.length > 1
          ? current.characters.filter((character) => character.id !== characterId)
          : current.characters,
    }));
  }

  function addCharacter() {
    const name = newCharacter.name.trim();
    if (!name) {
      setMessage("추가할 캐릭터 이름을 입력해 주세요.");
      return;
    }

    const nextId = uniqueId(makeId(newCharacter.id || name), draft.characters);
    setDraft((current) => ({
      ...current,
      characters: [
        ...current.characters,
        sanitizeCharacter({ ...newCharacter, id: nextId }, defaultCharacter),
      ],
    }));
    setNewCharacter(emptyCharacter);
    setMessage("캐릭터를 추가했습니다. 저장 버튼을 눌러 반영하세요.");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await onSave(draft);
      setMessage("게임 설정을 저장했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error ? `저장 실패: ${error.message}` : "저장 실패",
      );
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6">
      <section className="rounded-[2rem] bg-white/80 p-6 shadow-sm ring-1 ring-pink-100">
        <h2 className="text-2xl font-bold">배경화면 수정</h2>
        <p className="mt-2 text-sm leading-6 text-[#7c658d]">
          비워두면 기본 임시 배경이 보입니다. 이미지 URL을 넣으면 게임 화면
          배경으로 사용됩니다.
        </p>
        <input
          value={draft.backgroundUrl}
          onChange={(event) =>
            setDraft({ ...draft, backgroundUrl: event.target.value })
          }
          placeholder="https://.../background.png"
          className="mt-5 w-full rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
        />
        <div className="mt-3">
          <ImageFileField
            label="배경화면 파일 직접 선택"
            uploadFile={uploadImage}
            onUpload={(imageUrl) =>
              setDraft({ ...draft, backgroundUrl: imageUrl })
            }
          />
        </div>
      </section>

      <section className="rounded-[2rem] bg-white/80 p-6 shadow-sm ring-1 ring-pink-100">
        <h2 className="text-2xl font-bold">캐릭터 추가</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input
            value={newCharacter.name}
            onChange={(event) =>
              setNewCharacter({ ...newCharacter, name: event.target.value })
            }
            placeholder="캐릭터 이름"
            className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <input
            value={newCharacter.personality}
            onChange={(event) =>
              setNewCharacter({
                ...newCharacter,
                personality: event.target.value,
              })
            }
            placeholder="간단한 성격"
            className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <select
            value={newCharacter.personalityTag}
            onChange={(event) =>
              setNewCharacter({
                ...newCharacter,
                personalityTag: event.target.value as PersonalityTag,
              })
            }
            className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          >
            {personalityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                성격 태그: {option.label}
              </option>
            ))}
          </select>
          <input
            value={newCharacter.liftDialogue}
            onChange={(event) =>
              setNewCharacter({
                ...newCharacter,
                liftDialogue: event.target.value,
              })
            }
            placeholder="꾹 눌러 들었을 때 말풍선 대사"
            className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <input
            value={newCharacter.sdImageUrl}
            onChange={(event) =>
              setNewCharacter({
                ...newCharacter,
                sdImageUrl: event.target.value,
              })
            }
            placeholder="SD 이미지 URL"
            className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <ImageFileField
            label="SD 이미지 파일 직접 선택"
            uploadFile={uploadImage}
            onUpload={(imageUrl) =>
              setNewCharacter({ ...newCharacter, sdImageUrl: imageUrl })
            }
          />
          <input
            value={newCharacter.talkImageUrl}
            onChange={(event) =>
              setNewCharacter({
                ...newCharacter,
                talkImageUrl: event.target.value,
              })
            }
            placeholder="대화창 이미지 URL"
            className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <ImageFileField
            label="대화창 이미지 파일 직접 선택"
            uploadFile={uploadImage}
            onUpload={(imageUrl) =>
              setNewCharacter({ ...newCharacter, talkImageUrl: imageUrl })
            }
          />
          <button
            type="button"
            onClick={addCharacter}
            className="rounded-2xl bg-[#c8f0ff] px-5 py-3 font-bold text-[#315267]"
          >
            캐릭터 추가
          </button>
        </div>
      </section>

      <section className="grid gap-5">
        {draft.characters.map((character) => (
          <CharacterEditor
            key={character.id}
            character={character}
            canRemove={draft.characters.length > 1}
            uploadImage={uploadImage}
            onChange={(nextCharacter) =>
              updateCharacter(character.id, nextCharacter)
            }
            onRemove={() => removeCharacter(character.id)}
          />
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button className="rounded-2xl bg-[#b8a2ff] px-6 py-3 font-bold text-white transition hover:bg-[#9f7aea]">
          전체 설정 저장
        </button>
        {message ? (
          <p className="rounded-xl bg-[#e8dcff] px-4 py-3 text-sm text-[#6b4bb0]">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function CharacterEditor({
  character,
  canRemove,
  uploadImage,
  onChange,
  onRemove,
}: {
  character: GameCharacter;
  canRemove: boolean;
  uploadImage: (file: File) => Promise<string>;
  onChange: (character: GameCharacter) => void;
  onRemove: () => void;
}) {
  function updateSpecialDialogue(
    threshold: number,
    nextDialogue: Partial<SpecialDialogue>,
  ) {
    onChange({
      ...character,
      specialDialogues: character.specialDialogues.map((item) =>
        item.threshold === threshold ? { ...item, ...nextDialogue } : item,
      ),
    });
  }

  function updateTalkEvent(nextEvent: TalkEvent) {
    onChange({
      ...character,
      talkEvents: [nextEvent],
    });
  }

  const mainTalkEvent = character.talkEvents[0] ?? defaultTalkEvent;

  return (
    <article className="grid gap-5 rounded-[2rem] bg-[#fffdf7]/90 p-6 shadow-sm ring-1 ring-pink-100">
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="rounded-2xl bg-[#e8dcff] p-4 text-center">
          <div className="flex h-44 items-center justify-center rounded-xl bg-white/70">
            {character.sdImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={character.sdImageUrl}
                alt={`${character.name} SD 미리보기`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-6xl">🐾</span>
            )}
          </div>
          <p className="mt-3 text-sm font-bold text-[#6f5a7d]">SD 미리보기</p>
        </div>

        <div className="grid gap-3">
          <input
            value={character.name}
            onChange={(event) =>
              onChange({ ...character, name: event.target.value })
            }
            placeholder="캐릭터 이름"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <input
            value={character.personality}
            onChange={(event) =>
              onChange({ ...character, personality: event.target.value })
            }
            placeholder="간단한 성격"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <select
            value={character.personalityTag}
            onChange={(event) =>
              onChange({
                ...character,
                personalityTag: event.target.value as PersonalityTag,
              })
            }
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          >
            {personalityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                성격 태그: {option.label}
              </option>
            ))}
          </select>
          <input
            value={character.liftDialogue}
            onChange={(event) =>
              onChange({ ...character, liftDialogue: event.target.value })
            }
            placeholder="꾹 눌러 들었을 때 말풍선 대사"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <input
            value={character.sdImageUrl}
            onChange={(event) =>
              onChange({ ...character, sdImageUrl: event.target.value })
            }
            placeholder="게임 화면 SD 이미지 URL"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <ImageFileField
            label="게임 화면 SD 이미지 파일 직접 선택"
            uploadFile={uploadImage}
            onUpload={(imageUrl) =>
              onChange({ ...character, sdImageUrl: imageUrl })
            }
          />
          <input
            value={character.talkImageUrl}
            onChange={(event) =>
              onChange({ ...character, talkImageUrl: event.target.value })
            }
            placeholder="대화창 오른쪽 캐릭터 이미지 URL"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <ImageFileField
            label="대화창 캐릭터 이미지 파일 직접 선택"
            uploadFile={uploadImage}
            onUpload={(imageUrl) =>
              onChange({ ...character, talkImageUrl: imageUrl })
            }
          />
          <textarea
            value={character.dialogues.join("\n")}
            onChange={(event) =>
              onChange({
                ...character,
                dialogues: event.target.value.split("\n"),
              })
            }
            rows={5}
            placeholder="일반 대사를 줄마다 하나씩 입력"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 leading-7 outline-none transition focus:border-[#b8a2ff]"
          />
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="justify-self-start rounded-2xl bg-red-50 px-5 py-3 font-bold text-red-700"
            >
              캐릭터 삭제
            </button>
          ) : null}
        </div>
      </div>

      <section className="rounded-2xl bg-white/70 p-4">
        <h3 className="text-lg font-bold">호감도 특별 대사</h3>
        <p className="mt-1 text-sm text-[#7c658d]">
          호감도 20, 40, 60, 80, 100을 처음 넘을 때 표시됩니다.
        </p>
        <div className="mt-4 grid gap-4">
          {character.specialDialogues.map((item) => (
            <div key={item.threshold} className="grid gap-2 rounded-2xl bg-[#fffdf7] p-4">
              <p className="text-sm font-bold text-[#9f7aea]">
                호감도 {item.threshold}%
              </p>
              <input
                value={item.imageUrl}
                onChange={(event) =>
                  updateSpecialDialogue(item.threshold, {
                    imageUrl: event.target.value,
                  })
                }
                placeholder="특별 대사 이미지 URL"
                className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
              />
              <ImageFileField
                label="특별 대사 이미지 파일 직접 선택"
                uploadFile={uploadImage}
                onUpload={(imageUrl) =>
                  updateSpecialDialogue(item.threshold, { imageUrl })
                }
              />
              <textarea
                value={item.dialogue}
                onChange={(event) =>
                  updateSpecialDialogue(item.threshold, {
                    dialogue: event.target.value,
                  })
                }
                rows={2}
                placeholder="특별 대사"
                className="rounded-2xl border border-pink-100 bg-white px-4 py-3 leading-7 outline-none transition focus:border-[#b8a2ff]"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white/70 p-4">
        <h3 className="text-lg font-bold">이벤트 말걸기</h3>
        <p className="mt-1 text-sm text-[#7c658d]">
          말걸기 중 가끔 등장하며, 사용자가 답변 3개 중 하나를 고릅니다.
        </p>
        <div className="mt-4 grid gap-3">
          <input
            value={mainTalkEvent.imageUrl}
            onChange={(event) =>
              updateTalkEvent({ ...mainTalkEvent, imageUrl: event.target.value })
            }
            placeholder="이벤트 대화 이미지 URL"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
          />
          <ImageFileField
            label="이벤트 대화 이미지 파일 직접 선택"
            uploadFile={uploadImage}
            onUpload={(imageUrl) =>
              updateTalkEvent({ ...mainTalkEvent, imageUrl })
            }
          />
          <textarea
            value={mainTalkEvent.prompt}
            onChange={(event) =>
              updateTalkEvent({ ...mainTalkEvent, prompt: event.target.value })
            }
            rows={3}
            placeholder="이벤트 때 캐릭터 대사"
            className="rounded-2xl border border-pink-100 bg-white px-4 py-3 leading-7 outline-none transition focus:border-[#b8a2ff]"
          />
          {mainTalkEvent.choices.map((choice, index) => (
            <div key={index} className="grid gap-2 rounded-2xl bg-[#fffdf7] p-4 md:grid-cols-[1fr_1fr_120px]">
              <input
                value={choice.text}
                onChange={(event) => {
                  const choices = [...mainTalkEvent.choices];
                  choices[index] = { ...choice, text: event.target.value };
                  updateTalkEvent({ ...mainTalkEvent, choices });
                }}
                placeholder={`답변 ${index + 1}`}
                className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
              />
              <input
                value={choice.response}
                onChange={(event) => {
                  const choices = [...mainTalkEvent.choices];
                  choices[index] = { ...choice, response: event.target.value };
                  updateTalkEvent({ ...mainTalkEvent, choices });
                }}
                placeholder="선택 후 캐릭터 반응"
                className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
              />
              <input
                value={choice.affection}
                onChange={(event) => {
                  const choices = [...mainTalkEvent.choices];
                  choices[index] = {
                    ...choice,
                    affection: Number(event.target.value),
                  };
                  updateTalkEvent({ ...mainTalkEvent, choices });
                }}
                type="number"
                placeholder="호감도"
                className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#b8a2ff]"
              />
            </div>
          ))}
        </div>
      </section>
    </article>
  );
}
