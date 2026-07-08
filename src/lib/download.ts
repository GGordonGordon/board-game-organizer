export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 _()\-.]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

export function saveBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
