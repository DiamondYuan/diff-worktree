const LANGUAGE_ALIASES: Record<string, string> = {
  cjs: "javascript",
  htm: "html",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  mjs: "javascript",
  ps1: "powershell",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "shell",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
  zsh: "shell",
};

export function normalizeMonacoLanguage(language?: string) {
  const normalized = language?.trim().toLowerCase();

  if (!normalized) {
    return "plaintext";
  }

  return LANGUAGE_ALIASES[normalized] ?? normalized;
}
