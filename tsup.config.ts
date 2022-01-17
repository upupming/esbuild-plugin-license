import { Options } from 'tsup'

export default <Options>{
  format: [
    'cjs',
    'esm'
  ],
  clean: true,
  dts: true,
  entryPoints: [
    'src/index.ts'
  ],
  sourcemap: true,
  external: ['esbuild']
}
