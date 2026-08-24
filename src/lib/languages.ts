/**
 * Shared language type for the multi-language coding platform.
 *
 * Kept as a separate module so it can be imported from both server and
 * client code (project-store, page.tsx, py-editor, runner types, etc.)
 * without circular dependencies.
 */
export type Language =
  | 'python'
  | 'java'
  | 'c'
  | 'cpp'
  | 'r'
  | 'javascript'
  | 'php'
  | 'csharp'
  | 'dart'
  | 'flutter'
  | 'html'
  | 'sql'
  | 'kotlin'
  | 'go'
  | 'typescript'
  | 'rust'
  | 'ruby'
  | 'swift'
  | 'lua'
  | 'perl'
  | 'powershell'
  | 'bash'
  | 'fortran'
  | 'cobol'

export const ALL_LANGUAGES: Language[] = [
  'python', 'java', 'c', 'cpp', 'r', 'javascript', 'php', 'csharp',
  'dart', 'flutter', 'html', 'sql', 'kotlin', 'go', 'typescript',
  'rust', 'ruby', 'swift', 'lua', 'perl', 'powershell', 'bash',
  'fortran', 'cobol',
]

export function isLanguage(value: string | null | undefined): value is Language {
  return !!value && (ALL_LANGUAGES as string[]).includes(value)
}
