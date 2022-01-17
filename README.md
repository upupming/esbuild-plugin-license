# esbuild-plugin-license

[![npm (tag)](https://img.shields.io/npm/v/esbuild-plugin-license/latest?style=flat-square)](https://www.npmjs.com/package/esbuild-plugin-license)
![npm](https://img.shields.io/npm/dm/esbuild-plugin-license?style=flat-square)

License generation tool similar to https://github.com/mjeanroy/rollup-plugin-license

## Usage

```bash
npm i -D esbuild-plugin-license
```

```ts
import * as esbuild from 'esbuild'
import esbuildPluginLicense from 'esbuild-plugin-license';

esbuild.build({
  entryPoints: ['index.ts'],
  outdir: 'dist',
  plugins: [esbuildPluginLicense()],
  bundle: true,
  platform: 'node'
})

```

## Config

Example of default config

```ts
export const defaultOptions: DeepRequired<Options> = {
  banner: `/*! <%= pkg.name %> v<%= pkg.version %> | <%= pkg.license %> */`,
  thirdParty: {
    includePrivate: false,
    output: {
      file: 'dependencies.txt',
      // Template function that can be defined to customize report output
      template(dependencies) {
        return dependencies.map((dependency) => `${dependency.packageJson.name}:${dependency.packageJson.version} -- ${dependency.packageJson.license}`).join('\n');
      },
    }
  }
} as const
```
