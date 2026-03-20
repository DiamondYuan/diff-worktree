export function formatDisplayPath(input?: string, homeDir?: string) {
  if (!input || !homeDir) {
    return input ?? "";
  }

  if (input === homeDir) {
    return "~";
  }

  if (!input.startsWith(`${homeDir}/`)) {
    return input;
  }

  return input.replace(homeDir, "~");
}
