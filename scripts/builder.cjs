const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// Automatically parse .env if present
const envPath = path.resolve(__dirname, '../.env')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim()
      let val = trimmed.slice(eqIdx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (key && !process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

// Forward CLI arguments to electron-builder
const args = process.argv.slice(2)
const cliPath = path.resolve(__dirname, '../node_modules/electron-builder/out/cli/cli.js')

const child = spawn(process.execPath, [cliPath, ...args], {
  stdio: 'inherit',
  env: process.env
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
