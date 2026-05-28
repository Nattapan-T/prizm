import { parseDiff, getDiffStats } from './parseDiff'

const SAMPLE_DIFF = `diff --git a/src/Button.tsx b/src/Button.tsx
index 1234..5678 100644
--- a/src/Button.tsx
+++ b/src/Button.tsx
@@ -1,8 +1,10 @@
 function Button() {
-  return <button style={{color: '#1A73E8'}}>Click</button>
+  return <button style={{color: 'var(--color-primary)'}}>Click</button>
 }

diff --git a/src/Modal.tsx b/src/Modal.tsx
index abcd..efgh 100644
--- a/src/Modal.tsx
+++ b/src/Modal.tsx
@@ -1,5 +1,8 @@
 function Modal() {
-  return <div onClick={close}>X</div>
+  return <button aria-label="Close" onClick={close}>X</button>
 }

diff --git a/package.json b/package.json
index 0000..1111 100644
--- a/package.json
+++ b/package.json
@@ -1,3 +1,3 @@
-  "version": "1.0.0"
+  "version": "1.1.0"
`

const files = parseDiff(SAMPLE_DIFF)
const stats = getDiffStats(files)

console.log('Files found:', files.length)           // 3
console.log('Relevant files:', stats.relevantFiles)  // 2 (ไม่รวม package.json)
console.log('Skipped files:', stats.skippedFiles)    // 1 (package.json)

files.forEach(f => {
  console.log(`\n${f.filename} (${f.language}) — relevant: ${f.isRelevant}`)
  console.log('  additions:', f.additions.length)
  console.log('  deletions:', f.deletions.length)
})
