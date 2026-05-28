export type ParsedFile = {
  filename: string        // "src/components/Button.tsx"
  language: string        // "tsx", "ts", "css"
  additions: string[]     // บรรทัดที่เพิ่ม (ขึ้นต้นด้วย +)
  deletions: string[]     // บรรทัดที่ลบ (ขึ้นต้นด้วย -)
  hunks: string           // diff content ทั้งหมดของไฟล์นี้
  isRelevant: boolean     // เป็น frontend file ไหม
}

// ไฟล์ที่ PRetina สนใจ — frontend files เท่านั้น
const RELEVANT_EXTENSIONS = new Set([
  'tsx', 'ts', 'jsx', 'js',
  'css', 'scss', 'sass', 'less',
  'vue', 'svelte',
])

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return ext
}

function isRelevantFile(filename: string): boolean {
  const lang = getLanguage(filename)
  // ข้ามไฟล์ที่ไม่ใช่ frontend
  if (!RELEVANT_EXTENSIONS.has(lang)) return false
  // ข้าม test files — ไม่ต้องตรวจ DS ใน test
  if (filename.includes('.test.') || filename.includes('.spec.')) return false
  // ข้าม generated files
  if (filename.includes('.d.ts')) return false
  return true
}

export function parseDiff(diffText: string): ParsedFile[] {
  const files: ParsedFile[] = []

  // แยก diff ตาม "diff --git" header
  // แต่ละ file เริ่มต้นด้วย "diff --git a/... b/..."
  const fileSections = diffText.split(/^diff --git /m).filter(Boolean)

  for (const section of fileSections) {
    const lines = section.split('\n')

    // บรรทัดแรก: "a/path/to/file.tsx b/path/to/file.tsx"
    const headerLine = lines[0]
    const filenameMatch = headerLine.match(/b\/(.+)$/)
    if (!filenameMatch) continue

    const filename = filenameMatch[1].trim()
    const language = getLanguage(filename)
    const relevant = isRelevantFile(filename)

    // เก็บแค่บรรทัดที่เปลี่ยน (+ และ -)
    const additions: string[] = []
    const deletions: string[] = []

    // เก็บ hunk content ทั้งหมด (ตั้งแต่ @@ เป็นต้นไป)
    const hunkStart = lines.findIndex(l => l.startsWith('@@'))
    const hunks = hunkStart !== -1
      ? lines.slice(hunkStart).join('\n')
      : ''

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions.push(line.slice(1).trim())
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions.push(line.slice(1).trim())
      }
    }

    files.push({
      filename,
      language,
      additions,
      deletions,
      hunks,
      isRelevant: relevant,
    })
  }

  return files
}

// เฉพาะไฟล์ frontend ที่ PRetina ตรวจได้
export function getRelevantFiles(files: ParsedFile[]): ParsedFile[] {
  return files.filter(f => f.isRelevant)
}

// สรุปสถิติของ diff
export function getDiffStats(files: ParsedFile[]) {
  const relevant = getRelevantFiles(files)
  return {
    totalFiles: files.length,
    relevantFiles: relevant.length,
    skippedFiles: files.length - relevant.length,
    totalAdditions: files.reduce((sum, f) => sum + f.additions.length, 0),
    totalDeletions: files.reduce((sum, f) => sum + f.deletions.length, 0),
  }
}
