"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseClient, hasSupabaseEnv } from "@/lib/supabase";

type FruitStage = {
  name: string;
  radius: number;
  score: number;
  color: string;
  imageUrl: string;
  fallback: string;
};

type Fruit = {
  id: number;
  stageIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVelocity: number;
  squash: number;
  sloshX: number;
  sloshY: number;
  radius: number;
  settledFrames: number;
};

type GameSnapshot = {
  fruits: Fruit[];
  score: number;
  bestScore: number;
  nextStageIndex: number;
  isGameOver: boolean;
  canDrop: boolean;
  aimX: number;
};

const configStorageKey = "watermelon-game-fruit-config-v1";
const remoteConfigId = "main";
const remoteConfigTable = "watermelon_game_config";
const bestScoreStorageKey = "watermelon-game-best-score-v1";
const adminPin = process.env.NEXT_PUBLIC_WATERMELON_ADMIN_PIN ?? "admin";
const canvasWidth = 720;
const canvasHeight = 680;
const wallPadding = 28;
const dropY = 54;
const gravity = 0.32;
const airFriction = 0.996;
const bounce = 0.08;
const angularDamping = 0.975;
const mergeCooldownMs = 120;
const configDatabaseName = "watermelon-game";
const configObjectStoreName = "settings";
const cropOutputSize = 512;

const defaultStages: FruitStage[] = [
  { name: "체리", radius: 17, score: 2, color: "#ff6b9a", imageUrl: "", fallback: "C" },
  { name: "딸기", radius: 22, score: 5, color: "#ff4f6f", imageUrl: "", fallback: "S" },
  { name: "포도", radius: 28, score: 10, color: "#a86bf2", imageUrl: "", fallback: "G" },
  { name: "귤", radius: 34, score: 18, color: "#ffb23f", imageUrl: "", fallback: "T" },
  { name: "감", radius: 41, score: 30, color: "#ff8a3d", imageUrl: "", fallback: "P" },
  { name: "사과", radius: 48, score: 48, color: "#ff5a5f", imageUrl: "", fallback: "A" },
  { name: "배", radius: 55, score: 72, color: "#f2d16b", imageUrl: "", fallback: "B" },
  { name: "복숭아", radius: 63, score: 105, color: "#ffb7c8", imageUrl: "", fallback: "M" },
  { name: "파인애플", radius: 72, score: 150, color: "#f0ca3d", imageUrl: "", fallback: "P" },
  { name: "멜론", radius: 82, score: 210, color: "#91d66b", imageUrl: "", fallback: "M" },
  { name: "수박", radius: 94, score: 300, color: "#3fbf70", imageUrl: "", fallback: "W" },
];

function cloneStages(stages: FruitStage[]) {
  return stages.map((stage) => ({ ...stage }));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeStages(saved: unknown) {
  const parsed = Array.isArray(saved) ? (saved as Partial<FruitStage>[]) : [];

  return defaultStages.map((stage, index) => ({
    ...stage,
    name: parsed[index]?.name?.trim() || stage.name,
    imageUrl: parsed[index]?.imageUrl?.trim() || "",
  }));
}

function loadLegacyStages() {
  if (typeof window === "undefined") {
    return cloneStages(defaultStages);
  }

  try {
    const saved = window.localStorage.getItem(configStorageKey);
    if (!saved) {
      return cloneStages(defaultStages);
    }

    return normalizeStages(JSON.parse(saved));
  } catch {
    return cloneStages(defaultStages);
  }
}

function openConfigDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("이 브라우저는 IndexedDB 저장소를 지원하지 않습니다."));
      return;
    }

    const request = window.indexedDB.open(configDatabaseName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(configObjectStoreName)) {
        database.createObjectStore(configObjectStoreName);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("저장소를 열지 못했습니다."));
  });
}

async function loadStoredStages() {
  if (typeof window === "undefined") {
    return cloneStages(defaultStages);
  }

  try {
    const database = await openConfigDatabase();

    return await new Promise<FruitStage[]>((resolve, reject) => {
      const transaction = database.transaction(configObjectStoreName, "readonly");
      const store = transaction.objectStore(configObjectStoreName);
      const request = store.get(configStorageKey);

      request.onsuccess = () => {
        database.close();
        resolve(request.result ? normalizeStages(request.result) : loadLegacyStages());
      };
      request.onerror = () => {
        database.close();
        reject(request.error ?? new Error("과일 설정을 읽지 못했습니다."));
      };
    });
  } catch {
    return loadLegacyStages();
  }
}

async function saveStoredStages(stages: FruitStage[]) {
  const database = await openConfigDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(configObjectStoreName, "readwrite");
    const store = transaction.objectStore(configObjectStoreName);
    store.put(stages, configStorageKey);

    transaction.oncomplete = () => {
      database.close();
      window.localStorage.removeItem(configStorageKey);
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("과일 설정을 저장하지 못했습니다."));
    };
  });
}

async function clearStoredStages() {
  window.localStorage.removeItem(configStorageKey);

  try {
    const database = await openConfigDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(configObjectStoreName, "readwrite");
      const store = transaction.objectStore(configObjectStoreName);
      store.delete(configStorageKey);

      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("과일 설정을 초기화하지 못했습니다."));
      };
    });
  } catch {
    // Resetting should still work even if IndexedDB is unavailable.
  }
}

async function loadRemoteStages() {
  if (!hasSupabaseEnv) {
    return null;
  }

  try {
    const supabase = createSupabaseClient();
    const { data, error } = await supabase
      .from(remoteConfigTable)
      .select("stages")
      .eq("id", remoteConfigId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizeStages(data.stages);
  } catch {
    return null;
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/data:(.*);base64/)?.[1] ?? "image/webp";
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function uploadRemoteWatermelonImage(dataUrl: string, index: number) {
  if (!hasSupabaseEnv || !dataUrl.startsWith("data:image/")) {
    return dataUrl;
  }

  const supabase = createSupabaseClient();
  const blob = dataUrlToBlob(dataUrl);
  const path = `watermelon/${index + 1}-${Date.now()}-${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from("game-images")
    .upload(path, blob, {
      cacheControl: "3600",
      contentType: blob.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from("game-images").getPublicUrl(path);
  return data.publicUrl;
}

async function saveRemoteStages(stages: FruitStage[]) {
  if (!hasSupabaseEnv) {
    return false;
  }

  const supabase = createSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const userEmail = userResult.user?.email;

  if (userError || !userEmail) {
    throw new Error("/admin에서 Supabase 관리자 계정으로 먼저 로그인해 주세요.");
  }

  if (userEmail.toLowerCase() !== "superyunyoung@gmail.com") {
    throw new Error(
      `현재 로그인 계정은 ${userEmail}입니다. superyunyoung@gmail.com 계정으로 다시 로그인해 주세요.`,
    );
  }

  const stagesWithUploadedImages = await Promise.all(
    stages.map(async (stage, index) => ({
      ...stage,
      imageUrl: await uploadRemoteWatermelonImage(stage.imageUrl, index),
    })),
  );
  const { error } = await supabase.from(remoteConfigTable).upsert(
    {
      id: remoteConfigId,
      stages: stagesWithUploadedImages,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  return stagesWithUploadedImages;
}

async function clearRemoteStages() {
  if (!hasSupabaseEnv) {
    return false;
  }

  const supabase = createSupabaseClient();
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  const userEmail = userResult.user?.email;

  if (userError || !userEmail) {
    throw new Error("/admin에서 Supabase 관리자 계정으로 먼저 로그인해 주세요.");
  }

  if (userEmail.toLowerCase() !== "superyunyoung@gmail.com") {
    throw new Error(
      `현재 로그인 계정은 ${userEmail}입니다. superyunyoung@gmail.com 계정으로 다시 로그인해 주세요.`,
    );
  }

  const { error } = await supabase.from(remoteConfigTable).upsert(
    {
      id: remoteConfigId,
      stages: cloneStages(defaultStages),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

function loadBestScore() {
  if (typeof window === "undefined") {
    return 0;
  }

  return Number(window.localStorage.getItem(bestScoreStorageKey) ?? 0);
}

function pickNextStage() {
  return Math.floor(Math.random() * 5);
}

function loadImageElement(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = source;
  });
}

async function cropImageDataUrl(
  source: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
) {
  const image = await loadImageElement(source);
  const canvas = document.createElement("canvas");
  canvas.width = cropOutputSize;
  canvas.height = cropOutputSize;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지를 자를 수 없습니다.");
  }

  context.clearRect(0, 0, cropOutputSize, cropOutputSize);
  const containScale =
    Math.min(cropOutputSize / image.naturalWidth, cropOutputSize / image.naturalHeight) *
    zoom;
  const width = image.naturalWidth * containScale;
  const height = image.naturalHeight * containScale;
  const x = (cropOutputSize - width) / 2 + (offsetX / 100) * cropOutputSize * 0.5;
  const y = (cropOutputSize - height) / 2 + (offsetY / 100) * cropOutputSize * 0.5;

  context.drawImage(image, x, y, width, height);
  return canvas.toDataURL("image/webp", 0.88);
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("이미지 파일만 선택할 수 있습니다."));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("이미지는 8MB 이하로 선택해 주세요."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function drawFallbackFruit(
  context: CanvasRenderingContext2D,
  stage: FruitStage,
  fruit: Fruit,
) {
  const gradient = context.createRadialGradient(
    fruit.x - fruit.radius * 0.35,
    fruit.y - fruit.radius * 0.45,
    fruit.radius * 0.2,
    fruit.x,
    fruit.y,
    fruit.radius,
  );
  gradient.addColorStop(0, "#fff7d6");
  gradient.addColorStop(0.28, stage.color);
  gradient.addColorStop(1, "#2e7d46");

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = Math.max(2, fruit.radius * 0.06);
  context.strokeStyle = "rgba(255,255,255,0.65)";
  context.stroke();

  context.fillStyle = "rgba(46, 35, 64, 0.74)";
  context.font = `700 ${Math.max(18, fruit.radius * 0.62)}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(stage.fallback, fruit.x, fruit.y + 1);
}

function traceLiquidWave(
  context: CanvasRenderingContext2D,
  radius: number,
  level: number,
  amplitude: number,
  phase: number,
) {
  const left = -radius * 1.2;
  const right = radius * 1.2;
  const steps = 18;

  context.beginPath();
  context.moveTo(left, radius * 1.15);
  context.lineTo(left, level);
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const x = left + (right - left) * ratio;
    const y =
      level +
      Math.sin(ratio * Math.PI * 2 + phase) * amplitude +
      Math.sin(ratio * Math.PI * 4 - phase * 0.65) * amplitude * 0.35;
    context.lineTo(x, y);
  }
  context.lineTo(right, radius * 1.15);
  context.closePath();
}

function drawFruit(
  context: CanvasRenderingContext2D,
  fruit: Fruit,
  stage: FruitStage,
  time: number,
  image?: HTMLImageElement,
) {
  const speed = Math.hypot(fruit.vx, fruit.vy);
  const impactSquash = fruit.squash;
  const sloshX = fruit.sloshX + fruit.vx * 0.018;
  const sloshY = fruit.sloshY + fruit.vy * 0.012;
  const reboundWave = Math.sin(time / 170 + fruit.id * 0.7) * impactSquash;
  const shear = clamp(sloshX * 0.06 + reboundWave * 0.025, -0.12, 0.12);
  const liquidPhase = time / 260 + fruit.id * 0.73 + sloshX * 1.4 - sloshY * 0.9;
  const liquidEnergy = clamp(
    impactSquash * 1.25 + speed * 0.035 + Math.abs(sloshX) * 0.45 + Math.abs(sloshY) * 0.45,
    0,
    1,
  );
  const contentShiftX = clamp(-sloshX * fruit.radius * 0.24, -fruit.radius * 0.24, fruit.radius * 0.24);
  const contentShiftY = clamp(-sloshY * fruit.radius * 0.18, -fruit.radius * 0.2, fruit.radius * 0.2);
  const imageScaleX =
    1 + impactSquash * 0.24 + Math.min(0.1, Math.abs(sloshX) * 0.08);
  const imageScaleY =
    1 - impactSquash * 0.16 - Math.min(0.08, Math.abs(sloshY) * 0.06);
  const jellySheen = clamp(sloshX, -0.5, 0.5) * fruit.radius * 0.18;
  const liquidLevel = clamp(fruit.radius * (0.1 + sloshY * 0.2), -fruit.radius * 0.45, fruit.radius * 0.45);
  const waveAmplitude = fruit.radius * liquidEnergy * 0.18;

  context.save();
  context.translate(fruit.x, fruit.y);
  context.beginPath();
  context.ellipse(0, 0, fruit.radius, fruit.radius, 0, 0, Math.PI * 2);
  context.clip();

  context.save();
  context.rotate(fruit.angle);
  context.transform(1, shear, shear * 0.35, 1, 0, 0);
  context.scale(imageScaleX, imageScaleY);
  if (image?.complete && image.naturalWidth > 0) {
    context.drawImage(
      image,
      -fruit.radius * 1.08 + contentShiftX,
      -fruit.radius * 1.08 + contentShiftY,
      fruit.radius * 2.16,
      fruit.radius * 2.16,
    );
  } else {
    drawFallbackFruit(context, stage, {
      ...fruit,
      x: contentShiftX,
      y: contentShiftY,
    });
  }
  context.restore();

  const innerPool = context.createLinearGradient(0, liquidLevel - waveAmplitude, 0, fruit.radius);
  innerPool.addColorStop(0, "rgba(255,255,255,0.08)");
  innerPool.addColorStop(0.45, "rgba(255,255,255,0.18)");
  innerPool.addColorStop(1, "rgba(255,255,255,0.36)");
  context.fillStyle = innerPool;
  traceLiquidWave(context, fruit.radius, liquidLevel, waveAmplitude, liquidPhase);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.22)";
  context.lineWidth = Math.max(1.2, fruit.radius * 0.025);
  if (liquidEnergy > 0.03) {
    context.globalAlpha = Math.min(0.8, liquidEnergy * 1.4);
    for (let band = 0; band < 3; band += 1) {
      const bandY = liquidLevel + fruit.radius * (0.16 + band * 0.2);
      context.beginPath();
      for (let step = 0; step <= 18; step += 1) {
        const ratio = step / 18;
        const x = -fruit.radius + ratio * fruit.radius * 2;
        const y =
          bandY +
          Math.sin(ratio * Math.PI * 2 + liquidPhase + band) *
            waveAmplitude *
            (0.28 - band * 0.04);
        if (step === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  const gelGradient = context.createRadialGradient(
    -fruit.radius * 0.34 + jellySheen,
    -fruit.radius * 0.38,
    fruit.radius * 0.08,
    0,
    0,
    fruit.radius,
  );
  gelGradient.addColorStop(0, "rgba(255,255,255,0.46)");
  gelGradient.addColorStop(0.34, "rgba(255,255,255,0.1)");
  gelGradient.addColorStop(0.68, "rgba(255,255,255,0.03)");
  gelGradient.addColorStop(1, "rgba(37,28,50,0.22)");
  context.fillStyle = gelGradient;
  context.beginPath();
  context.ellipse(0, 0, fruit.radius, fruit.radius, 0, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.14;
  context.fillStyle = stage.color;
  context.beginPath();
  context.ellipse(0, 0, fruit.radius, fruit.radius, 0, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  context.strokeStyle = "rgba(255,255,255,0.25)";
  context.lineWidth = Math.max(1.5, fruit.radius * 0.045);
  context.beginPath();
  context.arc(
    -fruit.radius * 0.18 + jellySheen,
    -fruit.radius * 0.28,
    fruit.radius * 0.48,
    Math.PI * 0.9,
    Math.PI * 1.72,
  );
  context.stroke();

  context.restore();
  context.save();
  context.translate(fruit.x, fruit.y);
  context.beginPath();
  context.ellipse(0, 0, fruit.radius, fruit.radius, 0, 0, Math.PI * 2);
  context.lineWidth = Math.max(3, fruit.radius * 0.055);
  context.strokeStyle = "rgba(255,255,255,0.62)";
  context.stroke();
  context.beginPath();
  context.ellipse(
    0,
    0,
    fruit.radius - context.lineWidth * 0.7,
    fruit.radius - context.lineWidth * 0.7,
    0,
    0,
    Math.PI * 2,
  );
  context.strokeStyle = "rgba(255,255,255,0.16)";
  context.stroke();
  context.beginPath();
  context.ellipse(
    -fruit.radius * 0.28 + jellySheen,
    -fruit.radius * 0.36,
    fruit.radius * 0.24,
    fruit.radius * 0.14,
    -0.45,
    0,
    Math.PI * 2,
  );
  context.fillStyle = "rgba(255,255,255,0.42)";
  context.fill();
  context.beginPath();
  context.ellipse(
    fruit.radius * 0.22,
    fruit.radius * 0.26,
    fruit.radius * 0.42,
    fruit.radius * 0.16,
    -0.35,
    0,
    Math.PI * 2,
  );
  context.fillStyle = "rgba(255,255,255,0.08)";
  context.fill();
  context.restore();
}

function ImageUploadField({
  currentUrl,
  label,
  onUpload,
}: {
  currentUrl: string;
  label: string;
  onUpload: (imageUrl: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const imageUrl = await readImageFile(file);
      setCropSource(imageUrl);
      setZoom(1);
      setOffsetX(0);
      setOffsetY(0);
      setMessage("이미지를 불러왔습니다. 크롭을 맞춘 뒤 적용해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지를 불러오지 못했습니다.");
    }
  }

  async function applyCrop() {
    if (!cropSource) {
      return;
    }

    try {
      const croppedImageUrl = await cropImageDataUrl(cropSource, zoom, offsetX, offsetY);
      onUpload(croppedImageUrl);
      setCropSource("");
      setMessage("크롭한 이미지를 적용했습니다. 저장을 눌러 반영하세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지를 자르지 못했습니다.");
    }
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-dashed border-[#ffd1df] bg-white/70 p-3 text-sm font-bold text-[#6f5a7d]">
      <label className="grid gap-2">
        {label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => void handleChange(event)}
          className="block w-full text-sm text-[#7c658d] file:mr-4 file:rounded-full file:border-0 file:bg-[#ff8fb8] file:px-4 file:py-2 file:text-sm file:font-bold file:text-white"
        />
      </label>

      {cropSource ? (
        <div className="grid gap-3 rounded-2xl bg-[#fffdf7] p-3 ring-1 ring-pink-100">
          <div className="relative mx-auto aspect-square w-full max-w-64 overflow-hidden rounded-2xl bg-[#21192f]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cropSource}
              alt={`${label} 크롭 미리보기`}
              className="h-full w-full object-contain"
              style={{
                transform: `translate(${offsetX * 0.35}%, ${offsetY * 0.35}%) scale(${zoom})`,
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-4 ring-white/80" />
          </div>
          <label className="grid gap-1 text-xs">
            확대
            <input
              type="range"
              min="1"
              max="2.8"
              step="0.05"
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1 text-xs">
            좌우 위치
            <input
              type="range"
              min="-100"
              max="100"
              value={offsetX}
              onChange={(event) => setOffsetX(Number(event.target.value))}
            />
          </label>
          <label className="grid gap-1 text-xs">
            상하 위치
            <input
              type="range"
              min="-100"
              max="100"
              value={offsetY}
              onChange={(event) => setOffsetY(Number(event.target.value))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void applyCrop()}
              className="rounded-full bg-[#ff8fb8] px-4 py-2 text-xs font-bold text-white"
            >
              이 크롭 적용
            </button>
            <button
              type="button"
              onClick={() => setCropSource("")}
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-[#7c658d] ring-1 ring-pink-100"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}

      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt={`${label} 미리보기`}
          className="h-24 w-full rounded-xl bg-white object-contain"
        />
      ) : (
        <span className="flex h-20 items-center justify-center rounded-xl bg-[#fff7fb] text-xs font-normal text-[#9a829f]">
          아직 이미지가 없습니다.
        </span>
      )}
      {message ? <span className="text-xs font-normal">{message}</span> : null}
    </div>
  );
}

export function WatermelonGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fruitsRef = useRef<Fruit[]>([]);
  const lastMergeAtRef = useRef(0);
  const fruitIdRef = useRef(1);
  const imagesRef = useRef<(HTMLImageElement | undefined)[]>([]);

  const [stages, setStages] = useState<FruitStage[]>(() => cloneStages(defaultStages));
  const [snapshot, setSnapshot] = useState<GameSnapshot>(() => ({
    fruits: [],
    score: 0,
    bestScore: 0,
    nextStageIndex: 0,
    isGameOver: false,
    canDrop: true,
    aimX: canvasWidth / 2,
  }));
  const snapshotRef = useRef<GameSnapshot>(snapshot);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [draftStages, setDraftStages] = useState<FruitStage[]>(() => cloneStages(stages));
  const [message, setMessage] = useState("");

  const nextStage = stages[snapshot.nextStageIndex] ?? stages[0];
  const stageLegend = useMemo(() => stages.map((stage) => stage.name).join(" -> "), [stages]);

  useEffect(() => {
    const bestScore = loadBestScore();
    const nextStageIndex = pickNextStage();
    snapshotRef.current.bestScore = bestScore;
    snapshotRef.current.nextStageIndex = nextStageIndex;
    setSnapshot((current) => ({
      ...current,
      bestScore,
      nextStageIndex,
    }));
  }, []);

  useEffect(() => {
    let ignore = false;

    void (async () => {
      const remoteStages = await loadRemoteStages();
      const loadedStages = remoteStages ?? (await loadStoredStages());

      if (ignore) {
        return;
      }

      setStages(loadedStages);
      setDraftStages(cloneStages(loadedStages));
      if (remoteStages) {
        setMessage("공개 수박 게임 설정을 불러왔습니다.");
      }
    })();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    snapshotRef.current = {
      ...snapshotRef.current,
      bestScore: snapshot.bestScore,
      nextStageIndex: snapshot.nextStageIndex,
    };
  }, [snapshot.bestScore, snapshot.nextStageIndex]);

  useEffect(() => {
    const loadedImages = stages.map((stage) => {
      if (!stage.imageUrl) {
        return undefined;
      }

      const image = new Image();
      image.src = stage.imageUrl;
      return image;
    });
    imagesRef.current = loadedImages;
  }, [stages]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const drawingContext = canvas.getContext("2d");
    if (!drawingContext) {
      return;
    }
    const canvasElement: HTMLCanvasElement = canvas;
    const context: CanvasRenderingContext2D = drawingContext;

    function resizeCanvas() {
      const ratio = window.devicePixelRatio || 1;
      canvasElement.width = canvasWidth * ratio;
      canvasElement.height = canvasHeight * ratio;
      canvasElement.style.width = "100%";
      canvasElement.style.height = "auto";
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function publishSnapshot() {
      setSnapshot({
        ...snapshotRef.current,
        fruits: fruitsRef.current,
      });
    }

    function setBestScore(score: number) {
      if (score <= snapshotRef.current.bestScore) {
        return;
      }

      snapshotRef.current.bestScore = score;
      window.localStorage.setItem(bestScoreStorageKey, String(score));
    }

    function mergeFruits(first: Fruit, second: Fruit) {
      if (first.stageIndex >= stages.length - 1) {
        return false;
      }

      const now = performance.now();
      if (now - lastMergeAtRef.current < mergeCooldownMs) {
        return false;
      }

      const nextStageIndex = first.stageIndex + 1;
      const nextStage = stages[nextStageIndex];
      const mergedFruit: Fruit = {
        id: fruitIdRef.current,
        stageIndex: nextStageIndex,
        x: (first.x + second.x) / 2,
        y: (first.y + second.y) / 2,
        vx: (first.vx + second.vx) * 0.32,
        vy: (first.vy + second.vy) * 0.32 - 1.6,
        angle: (first.angle + second.angle) / 2,
        angularVelocity:
          (first.angularVelocity + second.angularVelocity) * 0.45 +
          (second.vx - first.vx) * 0.01,
        squash: 0.58,
        sloshX: (first.sloshX + second.sloshX) * 0.35,
        sloshY: (first.sloshY + second.sloshY) * 0.35 - 0.18,
        radius: nextStage.radius,
        settledFrames: 0,
      };

      fruitIdRef.current += 1;
      fruitsRef.current = fruitsRef.current
        .filter((fruit) => fruit.id !== first.id && fruit.id !== second.id)
        .concat(mergedFruit);
      snapshotRef.current.score += nextStage.score;
      setBestScore(snapshotRef.current.score);
      lastMergeAtRef.current = now;
      return true;
    }

    function resolveCollision(first: Fruit, second: Fruit) {
      const dx = second.x - first.x;
      const dy = second.y - first.y;
      const distance = Math.hypot(dx, dy) || 0.001;
      const minDistance = first.radius + second.radius;
      if (distance >= minDistance) {
        return;
      }

      if (first.stageIndex === second.stageIndex && mergeFruits(first, second)) {
        return;
      }

      const overlap = minDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      first.x -= nx * overlap * 0.5;
      first.y -= ny * overlap * 0.5;
      second.x += nx * overlap * 0.5;
      second.y += ny * overlap * 0.5;

      const relativeVelocity = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny;
      const tangentX = -ny;
      const tangentY = nx;
      const tangentVelocity =
        (second.vx - first.vx) * tangentX + (second.vy - first.vy) * tangentY;
      const impact = Math.min(0.72, Math.abs(relativeVelocity) * 0.065 + overlap * 0.014);
      first.squash = Math.max(first.squash, impact);
      second.squash = Math.max(second.squash, impact);
      first.sloshX = clamp(first.sloshX - nx * impact * 0.95, -0.9, 0.9);
      first.sloshY = clamp(first.sloshY - ny * impact * 0.95, -0.9, 0.9);
      second.sloshX = clamp(second.sloshX + nx * impact * 0.95, -0.9, 0.9);
      second.sloshY = clamp(second.sloshY + ny * impact * 0.95, -0.9, 0.9);
      if (relativeVelocity < 0) {
        const impulse = relativeVelocity * -0.24;
        first.vx -= impulse * nx;
        first.vy -= impulse * ny;
        second.vx += impulse * nx;
        second.vy += impulse * ny;
      }

      first.angularVelocity -= tangentVelocity / first.radius * 0.035;
      second.angularVelocity += tangentVelocity / second.radius * 0.035;
    }

    function stepPhysics() {
      if (snapshotRef.current.isGameOver) {
        return;
      }

      const fruits = fruitsRef.current;
      for (const fruit of fruits) {
        fruit.vy += gravity;
        fruit.vx *= airFriction;
        fruit.angularVelocity *= angularDamping;
        fruit.angle += fruit.angularVelocity;
        fruit.squash *= 0.955;
        fruit.sloshX = clamp(fruit.sloshX * 0.94 - fruit.vx * 0.003, -0.9, 0.9);
        fruit.sloshY = clamp(fruit.sloshY * 0.94 - fruit.vy * 0.002, -0.9, 0.9);
        fruit.x += fruit.vx;
        fruit.y += fruit.vy;

        if (fruit.x - fruit.radius < wallPadding) {
          const impactVelocity = Math.abs(fruit.vx);
          fruit.x = wallPadding + fruit.radius;
          fruit.vx = Math.abs(fruit.vx) * bounce;
          fruit.squash = Math.max(fruit.squash, Math.min(0.62, impactVelocity * 0.08));
          fruit.sloshX = clamp(fruit.sloshX - impactVelocity * 0.08, -0.9, 0.9);
        }

        if (fruit.x + fruit.radius > canvasWidth - wallPadding) {
          const impactVelocity = Math.abs(fruit.vx);
          fruit.x = canvasWidth - wallPadding - fruit.radius;
          fruit.vx = -Math.abs(fruit.vx) * bounce;
          fruit.squash = Math.max(fruit.squash, Math.min(0.62, impactVelocity * 0.08));
          fruit.sloshX = clamp(fruit.sloshX + impactVelocity * 0.08, -0.9, 0.9);
        }

        if (fruit.y + fruit.radius > canvasHeight - wallPadding) {
          const impactVelocity = Math.abs(fruit.vy);
          fruit.y = canvasHeight - wallPadding - fruit.radius;
          fruit.vy = -Math.abs(fruit.vy) * bounce;
          fruit.vx *= 0.92;
          fruit.angularVelocity += fruit.vx / fruit.radius * 0.06;
          fruit.squash = Math.max(fruit.squash, Math.min(0.72, impactVelocity * 0.09));
          fruit.sloshY = clamp(fruit.sloshY - impactVelocity * 0.08, -0.9, 0.9);
        }
      }

      for (let pass = 0; pass < 3; pass += 1) {
        for (let firstIndex = 0; firstIndex < fruitsRef.current.length; firstIndex += 1) {
          for (
            let secondIndex = firstIndex + 1;
            secondIndex < fruitsRef.current.length;
            secondIndex += 1
          ) {
            const first = fruitsRef.current[firstIndex];
            const second = fruitsRef.current[secondIndex];
            if (first && second) {
              resolveCollision(first, second);
            }
          }
        }
      }

      let highSettledFruit = false;
      for (const fruit of fruitsRef.current) {
        const isSettled = Math.abs(fruit.vx) + Math.abs(fruit.vy) < 0.55;
        fruit.settledFrames = isSettled ? fruit.settledFrames + 1 : 0;
        if (fruit.settledFrames > 90 && fruit.y - fruit.radius < 104) {
          highSettledFruit = true;
        }
      }

      if (highSettledFruit) {
        snapshotRef.current.isGameOver = true;
        snapshotRef.current.canDrop = false;
      }
    }

    function draw(time: number) {
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.fillStyle = "#fffdf7";
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      const skyGradient = context.createLinearGradient(0, 0, 0, canvasHeight);
      skyGradient.addColorStop(0, "#f8efff");
      skyGradient.addColorStop(0.55, "#e7f8ff");
      skyGradient.addColorStop(1, "#fff7d7");
      context.fillStyle = skyGradient;
      context.fillRect(0, 0, canvasWidth, canvasHeight);

      context.strokeStyle = "rgba(255, 143, 184, 0.75)";
      context.setLineDash([12, 12]);
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(wallPadding, 104);
      context.lineTo(canvasWidth - wallPadding, 104);
      context.stroke();
      context.setLineDash([]);

      context.fillStyle = "rgba(255,255,255,0.7)";
      context.fillRect(0, canvasHeight - wallPadding, canvasWidth, wallPadding);
      context.fillStyle = "rgba(255,143,184,0.14)";
      context.fillRect(0, 104, wallPadding, canvasHeight - 104);
      context.fillRect(canvasWidth - wallPadding, 104, wallPadding, canvasHeight - 104);

      const previewStage = stages[snapshotRef.current.nextStageIndex] ?? stages[0];
      const aimX = previewStage
        ? clamp(
            snapshotRef.current.aimX,
            wallPadding + previewStage.radius,
            canvasWidth - wallPadding - previewStage.radius,
          )
        : snapshotRef.current.aimX;
      context.strokeStyle = "rgba(107, 75, 176, 0.34)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(aimX, 28);
      context.lineTo(aimX, canvasHeight - wallPadding);
      context.stroke();

      if (previewStage) {
        drawFruit(
          context,
          {
            id: -1,
            stageIndex: snapshotRef.current.nextStageIndex,
            x: aimX,
            y: dropY,
            vx: 0,
            vy: 0,
            angle: time / 1800,
            angularVelocity: 0,
            squash: 0,
            sloshX: 0,
            sloshY: 0,
            radius: previewStage.radius,
            settledFrames: 0,
          },
          previewStage,
          time,
          imagesRef.current[snapshotRef.current.nextStageIndex],
        );
      }

      for (const fruit of fruitsRef.current) {
        drawFruit(
          context,
          fruit,
          stages[fruit.stageIndex],
          time,
          imagesRef.current[fruit.stageIndex],
        );
      }

      if (snapshotRef.current.isGameOver) {
        context.fillStyle = "rgba(46,35,64,0.72)";
        context.fillRect(0, 0, canvasWidth, canvasHeight);
        context.fillStyle = "#ffffff";
        context.font = "700 54px Arial";
        context.textAlign = "center";
        context.fillText("GAME OVER", canvasWidth / 2, canvasHeight / 2 - 18);
        context.font = "700 26px Arial";
        context.fillText("다시 시작해서 수박을 만들어 보세요", canvasWidth / 2, canvasHeight / 2 + 32);
      }
    }

    function tick(time: number) {
      stepPhysics();
      draw(time);
      publishSnapshot();
      animationFrameRef.current = window.requestAnimationFrame(tick);
    }

    resizeCanvas();
    animationFrameRef.current = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stages]);

  function setAimFromPointer(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvasWidth;
    const nextRadius = stages[snapshotRef.current.nextStageIndex]?.radius ?? 17;
    snapshotRef.current.aimX = clamp(
      x,
      wallPadding + nextRadius,
      canvasWidth - wallPadding - nextRadius,
    );
  }

  function dropFruit() {
    if (!snapshotRef.current.canDrop || snapshotRef.current.isGameOver) {
      return;
    }

    const stageIndex = snapshotRef.current.nextStageIndex;
    const stage = stages[stageIndex];
    const dropX = clamp(
      snapshotRef.current.aimX,
      wallPadding + stage.radius,
      canvasWidth - wallPadding - stage.radius,
    );
    fruitsRef.current = fruitsRef.current.concat({
      id: fruitIdRef.current,
      stageIndex,
      x: dropX,
      y: dropY,
      vx: 0,
      vy: 1.2,
      angle: Math.random() * Math.PI * 2,
      angularVelocity: (Math.random() - 0.5) * 0.05,
      squash: 0.08,
      sloshX: 0,
      sloshY: -0.16,
      radius: stage.radius,
      settledFrames: 0,
    });
    fruitIdRef.current += 1;
    snapshotRef.current.nextStageIndex = pickNextStage();
    snapshotRef.current.canDrop = false;
    window.setTimeout(() => {
      if (!snapshotRef.current.isGameOver) {
        snapshotRef.current.canDrop = true;
      }
    }, 420);
  }

  function restartGame() {
    fruitsRef.current = [];
    snapshotRef.current = {
      fruits: [],
      score: 0,
      bestScore: loadBestScore(),
      nextStageIndex: pickNextStage(),
      isGameOver: false,
      canDrop: true,
      aimX: canvasWidth / 2,
    };
    setSnapshot({ ...snapshotRef.current });
  }

  async function saveAdminSettings() {
    const nextStages = defaultStages.map((stage, index) => ({
      ...stage,
      name: draftStages[index]?.name?.trim() || stage.name,
      imageUrl: draftStages[index]?.imageUrl?.trim() || "",
    }));

    try {
      const remoteStages = await saveRemoteStages(nextStages);
      const savedStages = remoteStages || nextStages;

      if (!remoteStages) {
        await saveStoredStages(nextStages);
      }

      setStages(savedStages);
      setDraftStages(cloneStages(savedStages));
      setMessage(
        remoteStages
          ? "공개 수박 게임 설정을 저장했습니다. 다른 사람에게도 같은 이미지가 보입니다."
          : "과일 단계 이미지를 이 브라우저에 저장했습니다.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `저장 실패: ${error.message} Supabase 관리자 로그인이 필요할 수 있습니다.`
          : "저장에 실패했습니다.",
      );
    }
  }

  async function resetAdminSettings() {
    try {
      const remoteReset = await clearRemoteStages();
      if (!remoteReset) {
        await clearStoredStages();
      }

      const defaultStageConfig = cloneStages(defaultStages);
      setStages(defaultStageConfig);
      setDraftStages(cloneStages(defaultStageConfig));
      setMessage(
        remoteReset
          ? "공개 수박 게임 설정을 기본값으로 되돌렸습니다."
          : "이 브라우저의 과일 설정을 기본값으로 되돌렸습니다.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `초기화 실패: ${error.message} Supabase 관리자 로그인이 필요할 수 있습니다.`
          : "초기화에 실패했습니다.",
      );
    }
  }

  function openAdmin() {
    if (pin !== adminPin) {
      setMessage("관리자 PIN이 맞지 않습니다. 기본 PIN은 admin입니다.");
      return;
    }

    setIsAdminOpen(true);
    setMessage("관리자 설정을 열었습니다.");
  }

  return (
    <main className="pastel-page min-h-screen px-5 py-8 text-[#3f2a56] sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,780px)_380px]">
        <section className="rounded-[2rem] bg-white/80 p-4 shadow-sm ring-1 ring-pink-100 sm:p-6">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#ff7aa8]">Watermelon Game</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
                과일을 합쳐 수박 만들기
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6f5a7d] sm:text-base">
                같은 단계의 과일이 닿으면 다음 단계로 합쳐집니다. 빨간 선 위까지
                과일이 쌓이면 게임이 종료됩니다.
              </p>
            </div>
            <div className="rounded-2xl bg-[#fff7fb] px-4 py-3 text-right ring-1 ring-pink-100">
              <p className="text-sm font-bold text-[#7c658d]">점수</p>
              <p className="text-3xl font-bold">{snapshot.score}</p>
              <p className="text-xs font-bold text-[#9a829f]">최고 {snapshot.bestScore}</p>
            </div>
          </header>

          <div className="overflow-hidden rounded-[1.5rem] bg-[#fffdf7] shadow-inner ring-1 ring-pink-100">
            <canvas
              ref={canvasRef}
              onPointerMove={setAimFromPointer}
              onPointerDown={(event) => {
                setAimFromPointer(event);
                dropFruit();
              }}
              className="block w-full touch-none"
              aria-label="수박 게임 화면"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="rounded-2xl bg-[#fffdf7] px-4 py-3 ring-1 ring-pink-100">
              <p className="text-sm font-bold text-[#7c658d]">다음 과일</p>
              <p className="mt-1 text-xl font-bold">{nextStage.name}</p>
            </div>
            <button
              onClick={dropFruit}
              disabled={!snapshot.canDrop || snapshot.isGameOver}
              className="rounded-2xl bg-[#ff8fb8] px-6 py-3 font-bold text-white transition hover:bg-[#f06f9f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              떨어뜨리기
            </button>
            <button
              onClick={restartGame}
              className="rounded-2xl bg-[#b8a2ff] px-6 py-3 font-bold text-white transition hover:bg-[#9f7aea]"
            >
              다시 시작
            </button>
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="rounded-[2rem] bg-[#fffdf7]/90 p-6 shadow-sm ring-1 ring-pink-100">
            <h2 className="text-2xl font-bold">과일 단계</h2>
            <p className="mt-2 text-sm leading-6 text-[#7c658d]">{stageLegend}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {stages.map((stage, index) => (
                <div
                  key={stage.name}
                  className="rounded-2xl bg-white/80 p-3 text-center ring-1 ring-pink-100"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#fff7fb]">
                    {stage.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={stage.imageUrl}
                        alt={`${stage.name} 이미지`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-xl font-bold text-[#7c658d]">
                        {stage.fallback}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-bold">
                    {index + 1}. {stage.name}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] bg-white/80 p-6 shadow-sm ring-1 ring-pink-100">
            <h2 className="text-2xl font-bold">관리자 이미지 설정</h2>
            <p className="mt-2 text-sm leading-6 text-[#7c658d]">
              단계별 과일 이미지를 직접 업로드할 수 있습니다. Supabase 관리자
              로그인 상태라면 공개 설정으로 저장되어 모든 방문자에게 같은
              이미지가 보입니다.
            </p>

            {!isAdminOpen ? (
              <div className="mt-5 grid gap-3">
                <input
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  type="password"
                  placeholder="관리자 PIN"
                  className="rounded-2xl border border-pink-100 bg-[#fffdf7] px-4 py-3 outline-none transition focus:border-[#ff8fb8]"
                />
                <button
                  type="button"
                  onClick={openAdmin}
                  className="rounded-2xl bg-[#c8f0ff] px-5 py-3 font-bold text-[#315267]"
                >
                  관리자 설정 열기
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-4">
                {draftStages.map((stage, index) => (
                  <article key={index} className="grid gap-3 rounded-2xl bg-[#fff7fb] p-4">
                    <input
                      value={stage.name}
                      onChange={(event) => {
                        const nextStages = cloneStages(draftStages);
                        nextStages[index].name = event.target.value;
                        setDraftStages(nextStages);
                      }}
                      className="rounded-2xl border border-pink-100 bg-white px-4 py-3 outline-none transition focus:border-[#ff8fb8]"
                    />
                    <ImageUploadField
                      currentUrl={stage.imageUrl}
                      label={`${index + 1}단계 ${stage.name} 이미지`}
                      onUpload={(imageUrl) => {
                        const nextStages = cloneStages(draftStages);
                        nextStages[index].imageUrl = imageUrl;
                        setDraftStages(nextStages);
                      }}
                    />
                  </article>
                ))}
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void saveAdminSettings()}
                    className="rounded-2xl bg-[#ff8fb8] px-5 py-3 font-bold text-white"
                  >
                    과일 이미지 저장
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetAdminSettings()}
                    className="rounded-2xl bg-red-50 px-5 py-3 font-bold text-red-700"
                  >
                    기본값으로 되돌리기
                  </button>
                </div>
              </div>
            )}

            {message ? (
              <p className="mt-4 rounded-xl bg-[#e8dcff] px-4 py-3 text-sm text-[#6b4bb0]">
                {message}
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </main>
  );
}
