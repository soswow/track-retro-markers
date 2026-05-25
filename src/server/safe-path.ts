import { mkdir, realpath } from "node:fs/promises";
import { join, normalize, relative, resolve } from "node:path";

export type SafePathResolver = {
  rootDirectory: string;
  resolveRelativePath: (relativePath: string) => Promise<string>;
  toRelativeUrlPath: (absolutePath: string) => string;
};

export const createSafePathResolver = async (rootDirectory: string): Promise<SafePathResolver> => {
  await mkdir(resolve(rootDirectory), { recursive: true });

  const resolvedRootDirectory = await realpath(resolve(rootDirectory));

  const resolveRelativePath = async (relativePath: string): Promise<string> => {
    const normalizedRelativePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const candidatePath = resolve(resolvedRootDirectory, normalizedRelativePath);
    const resolvedCandidatePath = await realpath(candidatePath);
    const pathDifference = relative(resolvedRootDirectory, resolvedCandidatePath);

    if (pathDifference.startsWith("..") || pathDifference.includes("..")) {
      throw new Error(`Path escapes configured root: ${relativePath}`);
    }

    return resolvedCandidatePath;
  };

  const toRelativeUrlPath = (absolutePath: string): string => {
    const pathDifference = relative(resolvedRootDirectory, absolutePath);

    if (pathDifference.startsWith("..") || pathDifference.includes("..")) {
      throw new Error("Path is outside configured root.");
    }

    return pathDifference.split("\\").join("/");
  };

  return {
    rootDirectory: resolvedRootDirectory,
    resolveRelativePath,
    toRelativeUrlPath
  };
};

export const joinSafeRelativePath = (...segments: string[]): string => {
  return join(...segments).split("\\").join("/");
};
