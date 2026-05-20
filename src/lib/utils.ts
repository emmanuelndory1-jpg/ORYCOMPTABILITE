import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function extractJSON(text: string): string {
  if (!text) return '""';
  // Attempt to remove markdown code blocks
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    return match[1];
  }
  return text;
}

export function parseSafeJSON<T = any>(text: string | null | undefined, fallback: any = null): T {
  if (!text) return fallback;
  try {
    return JSON.parse(extractJSON(text));
  } catch (e) {
    console.error("Error parsing JSON:", e);
    return fallback;
  }
}
