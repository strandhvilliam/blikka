import type { ParticipantSelectedPhoto } from "./participant-upload-types";

export interface LocalSaveEntry<TFile = File> {
  path: string;
  pathSegments: readonly [string, string, string, string];
  file: TFile;
}

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };

export function formatTopicOrderIndex(orderIndex: number) {
  return String(orderIndex).padStart(2, "0");
}

export function buildLocalSavePath(params: {
  domain: string;
  participantReference: string;
  orderIndex: number;
  fileName: string;
}) {
  const pathSegments = [
    params.domain,
    params.participantReference,
    formatTopicOrderIndex(params.orderIndex),
    params.fileName,
  ] as const;

  return {
    path: pathSegments.join("/"),
    pathSegments,
  };
}

export function buildLocalSaveEntries<TFile extends { name: string }>(params: {
  domain: string;
  participantReference: string;
  photos: Array<{ orderIndex: number; file: TFile }>;
}): LocalSaveEntry<TFile>[] {
  return params.photos.map((photo) => {
    const builtPath = buildLocalSavePath({
      domain: params.domain,
      participantReference: params.participantReference,
      orderIndex: photo.orderIndex,
      fileName: photo.file.name,
    });

    return {
      ...builtPath,
      file: photo.file,
    };
  });
}

export function supportsDirectoryPicker(
  pickerWindow?: Pick<DirectoryPickerWindow, "showDirectoryPicker">,
) {
  if (!pickerWindow) {
    return typeof window !== "undefined" &&
      typeof (window as DirectoryPickerWindow).showDirectoryPicker === "function";
  }

  return typeof pickerWindow.showDirectoryPicker === "function";
}

export function getCollisionSafeFileName(
  requestedName: string,
  existingNames: Set<string>,
) {
  if (!existingNames.has(requestedName)) {
    return requestedName;
  }

  const extensionIndex = requestedName.lastIndexOf(".");
  const hasExtension = extensionIndex > 0;
  const baseName = hasExtension
    ? requestedName.slice(0, extensionIndex)
    : requestedName;
  const extension = hasExtension ? requestedName.slice(extensionIndex) : "";

  let suffix = 1;
  let candidate = `${baseName}-${suffix}${extension}`;
  while (existingNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName}-${suffix}${extension}`;
  }

  return candidate;
}

async function writeEntriesToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  entries: LocalSaveEntry[],
) {
  const createdByFolder = new Map<string, Set<string>>();

  for (const entry of entries) {
    const [domain, participantReference, topicFolder, fileName] =
      entry.pathSegments;
    const rootHandle = await directoryHandle.getDirectoryHandle(domain, {
      create: true,
    });
    const participantHandle = await rootHandle.getDirectoryHandle(
      participantReference,
      {
        create: true,
      },
    );
    const topicHandle = await participantHandle.getDirectoryHandle(topicFolder, {
      create: true,
    });

    const folderKey = `${domain}/${participantReference}/${topicFolder}`;
    const existingNames = createdByFolder.get(folderKey) ?? new Set<string>();
    const safeFileName = getCollisionSafeFileName(fileName, existingNames);
    existingNames.add(safeFileName);
    createdByFolder.set(folderKey, existingNames);

    const fileHandle = await topicHandle.getFileHandle(safeFileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(entry.file);
    await writable.close();
  }
}

async function downloadEntriesAsZip(entries: LocalSaveEntry[], archiveName: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const createdByFolder = new Map<string, Set<string>>();

  for (const entry of entries) {
    const folderKey = entry.pathSegments.slice(0, 3).join("/");
    const existingNames = createdByFolder.get(folderKey) ?? new Set<string>();
    const safeFileName = getCollisionSafeFileName(
      entry.pathSegments[3],
      existingNames,
    );
    existingNames.add(safeFileName);
    createdByFolder.set(folderKey, existingNames);

    zip.file(
      [...entry.pathSegments.slice(0, 3), safeFileName].join("/"),
      entry.file,
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = archiveName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export async function saveParticipantPhotosLocally(params: {
  domain: string;
  participantReference: string;
  photos: ParticipantSelectedPhoto[];
  pickerWindow?: Pick<DirectoryPickerWindow, "showDirectoryPicker">;
}) {
  const entries = buildLocalSaveEntries({
    domain: params.domain,
    participantReference: params.participantReference,
    photos: params.photos,
  });

  const pickerWindow =
    params.pickerWindow ??
    (typeof window !== "undefined"
      ? (window as DirectoryPickerWindow)
      : undefined);

  if (pickerWindow && supportsDirectoryPicker(pickerWindow)) {
    const directoryHandle = await pickerWindow.showDirectoryPicker!();
    await writeEntriesToDirectory(directoryHandle, entries);
    return { mode: "directory" as const, entries };
  }

  const archiveName = `${params.domain}-${params.participantReference}-upload-backup.zip`;
  await downloadEntriesAsZip(entries, archiveName);
  return { mode: "zip" as const, entries };
}
