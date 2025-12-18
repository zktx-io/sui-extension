export function validateProjectName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Folder name cannot be empty';
  }
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return 'Folder name must not include path separators';
  }
  if (trimmed === '.' || trimmed === '..' || trimmed.includes('..')) {
    return 'Folder name must not include ".."';
  }
  return null;
}
