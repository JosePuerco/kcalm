// Deployt Kcalm auf den Pi (Container kcalm-web hinter dem Cloudflare-Tunnel).
// Aufruf: npm run deploy   (anderes Ziel: $env:PI_HOST = 'jan@…'; npm run deploy)
//
// Ausgeliefert wird nur der committete Stand (HEAD), und nur wenn er getaggt (v<Version>)
// und auf GitHub ist und Tests und Lint grün sind. Vorbild: setlog/scripts/deploy.sh.
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const piHost = process.env.PI_HOST ?? 'jan@pi.local'
const container = 'kcalm-web'
const remoteDir = '~/kcalm-web/src'

process.chdir(fileURLToPath(new URL('../', import.meta.url)))

function fail(message: string): never {
  console.error(`\nFehler: ${message}`)
  process.exit(1)
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function succeeds(command: string, args: string[]): boolean {
  try {
    execFileSync(command, args, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function ssh(remoteCommand: string): string {
  return execFileSync('ssh', ['-o', 'BatchMode=yes', piHost, remoteCommand], { encoding: 'utf8' }).trim()
}

// 1. Nur committeter Stand
if (git('status', '--porcelain') !== '') {
  fail('Es gibt nicht committete Änderungen. Erst committen (deployt wird nur HEAD).')
}

// 2. Jeder Deploy ist eine Version: Tag v<Version> muss auf HEAD zeigen
const version = (JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }).version
const commit = git('rev-parse', '--short', 'HEAD')
if (!git('tag', '--points-at', 'HEAD').split('\n').includes(`v${version}`)) {
  fail(`Tag v${version} zeigt nicht auf HEAD. Erst Version erhöhen, CHANGELOG.md ergänzen und taggen.`)
}

// 3. Was live läuft, steht auch auf GitHub
git('fetch', '--quiet', 'origin', 'main')
if (!succeeds('git', ['merge-base', '--is-ancestor', 'HEAD', 'origin/main'])) {
  fail('HEAD ist noch nicht auf GitHub (origin/main). Erst pushen.')
}

console.log(`Deploy Kcalm ${version} (${commit}) nach ${piHost}`)

// 4. Tests und Lint (shell: npm ist unter Windows eine .cmd-Datei)
for (const script of ['test', 'run lint']) {
  try {
    execFileSync(`npm ${script}`, { stdio: 'inherit', shell: true })
  } catch {
    fail(`npm ${script} ist fehlgeschlagen, nichts deployt.`)
  }
}

// 5. HEAD als tar auf den Pi, dort bauen und starten
await new Promise<void>((resolve, reject) => {
  const archive = spawn('git', ['archive', '--format=tar', 'HEAD'], { stdio: ['ignore', 'pipe', 'inherit'] })
  const remote = spawn(
    'ssh',
    [
      '-o',
      'BatchMode=yes',
      piHost,
      `set -e; rm -rf ${remoteDir}; mkdir -p ${remoteDir}; tar -x -C ${remoteDir}; cd ${remoteDir}; docker compose up -d --build`,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  )
  archive.stdout.pipe(remote.stdin)
  archive.on('error', reject)
  remote.on('error', reject)
  remote.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ssh endete mit ${code}`))))
}).catch((error: unknown) => fail(`Übertragen oder Bauen auf dem Pi fehlgeschlagen (${String(error)}).`))

// 6. Warten, bis der Container gesund ist (bis zu 30 × 2 s)
process.stdout.write('Warte auf den Container ')
for (let attempt = 0; attempt < 30; attempt++) {
  let status = ''
  try {
    status = ssh(`docker inspect -f '{{.State.Health.Status}}' ${container}`)
  } catch {
    // Container noch nicht da, nächster Versuch
  }
  if (status === 'healthy') {
    console.log(`\nDeploy ok: Kcalm ${version} (${commit}) läuft auf dem Pi.`)
    process.exit(0)
  }
  process.stdout.write('.')
  await new Promise((resolve) => setTimeout(resolve, 2000))
}
try {
  console.error(ssh(`docker logs --tail 50 ${container}`))
} catch {
  // Logs sind nur eine Hilfe
}
fail(`${container} ist nicht gesund geworden.`)
