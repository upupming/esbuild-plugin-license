import * as esbuild from 'esbuild'
import esbuildPluginLicense from '../..'
import path from 'path'
import fs from 'fs'

describe('esbuildPluginLicense', () => {
  it('should generate dependencies and inject banner', async () => {
    const outdir = path.join(__dirname, 'dist')

    await esbuild.build({
      entryPoints: [path.join(__dirname, 'index.ts')],
      plugins: [esbuildPluginLicense()],
      bundle: true,
      platform: 'node',
      write: true,
      outdir
    })

    const outfiles = await (await fs.promises.readdir(outdir)).map(file => ({
      path: file,
      content: fs.readFileSync(path.join(outdir, file)).toString()
    }))

    expect(outfiles).toMatchSnapshot()
  }, 100000)
})
