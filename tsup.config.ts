import { Options } from 'tsup'
import commonjsPlugin from '@chialab/esbuild-plugin-commonjs';

export default <Options>{
  format: [
    'cjs',
    'esm'
  ],
  clean: true,
  dts: {
    resolve: true
  },
  entryPoints: [
    'src/index.ts'
  ],
  // some packages has no esm format, for example, `error-ex/index.js`
  // so we have to convert `require('util')` to `import * as util from 'util'`
  // see discuss here: https://github.com/evanw/esbuild/issues/1921#issuecomment-1010490128
  esbuildPlugins: [commonjsPlugin()],
  sourcemap: true,
  external: ['esbuild']
}
