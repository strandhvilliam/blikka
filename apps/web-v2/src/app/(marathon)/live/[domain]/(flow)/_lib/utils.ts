import { Effect } from "effect";
import { ExifParser } from "@blikka/image-manipulation/exif-parser";

import type { RuleConfig } from "@blikka/db";
import {
  RULE_KEYS,
  type ValidationRule, type RuleKey, type RuleParams, type SeverityLevel } from "@blikka/validation";

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function mapDbRuleConfigsToValidationRules(
  dbRuleConfigs: RuleConfig[]
): ValidationRule[] {
  return dbRuleConfigs
    .filter((rule) => rule.enabled)
    .map((rule) => ({
      ruleKey: rule.ruleKey as RuleKey,
      enabled: rule.enabled,
      severity: rule.severity as SeverityLevel,
      params: {
        [rule.ruleKey]: rule.params,
      } as RuleParams
    }));
} 
export function prepareValidationRules(validationRules: ValidationRule[], { start, end }: { start?: string | Date, end?: string | Date }): ValidationRule[] {
  return validationRules.map((rule) => {
    if (
      rule.ruleKey === RULE_KEYS.WITHIN_TIMERANGE &&
      start &&
      end
    ) {
      return {
        ...rule,
        params: {
          ...rule.params,
          [RULE_KEYS.WITHIN_TIMERANGE]: {
            start: start instanceof Date ? start.toISOString() : new Date(start).toISOString(),
            end: end instanceof Date ? end.toISOString() : new Date(end).toISOString(),
          },
        },
      };
    }
    return rule;
  });
}


export async function parseExifData(file: File): Promise<Record<string, unknown> | null> {
  try {
    const buff = await file.arrayBuffer();
    const tags = await Effect.runPromise(ExifParser.parse(new Uint8Array(buff)).pipe(Effect.provide(ExifParser.Default)))
    return tags as Record<string, unknown>;
  } catch {
    return null;
  }
} 


export function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)
  );
};

export async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const heic2any = await import("heic2any");
    const result = await heic2any.default({
      blob: file,
      toType: "image/jpeg",
      quality: 1,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) return null;

    return new File(
      [blob],
      file.name.replace(/\.heic$/i, ".jpg").replace(/\.heif$/i, ".jpg"),
      { type: "image/jpeg" },
    );
  } catch (error) {
    console.error(`Failed to convert HEIC file ${file.name}:`, error);
    return null;
  }
};


export function getExifDate(exif: Record<string, unknown>): Date | null {
  if (!exif) return null;
  const dateValue = exif.DateTimeOriginal || exif.CreateDate;
  if (!dateValue) return null;
  try {
    const date = new Date(dateValue as string);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};