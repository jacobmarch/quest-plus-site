export const MAP_BUCKET = "maps";
export const MAX_MAP_BYTES = 10 * 1024 * 1024;
export const MAP_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateMapName(value: string): string {
  const name = value.trim();
  if (!name || name.length > 120) {
    throw new Error("Map name must be between 1 and 120 characters.");
  }
  return name;
}

export function validateMapFile(file: Pick<File, "size" | "type">): string {
  const extension = MAP_IMAGE_TYPES[file.type];
  if (!extension) throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (!file.size || file.size > MAX_MAP_BYTES) {
    throw new Error("Choose a non-empty image no larger than 10 MB.");
  }
  return extension;
}

export function validMapStoragePath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) &&
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(path);
}
