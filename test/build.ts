import * as esbuild from 'esbuild'
import esbuildPluginLicense from '../src/index'

const args = process.argv.slice(2)

esbuild.build({
  entryPoints: ['index.ts'],
  outdir: 'dist',
  watch: args[0] === '--watch',
  plugins: [esbuildPluginLicense()],
  bundle: true,
  platform: 'node'
})
