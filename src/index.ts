import { Plugin } from 'esbuild';
import * as _ from 'lodash-es'
import path from 'path';
import { NormalizedReadResult, readPackageUp, NormalizedPackageJson } from 'read-pkg-up'
import fs from 'fs/promises'

type NotNill<T> = T extends null | undefined ? never : T;

type Primitive = undefined | null | boolean | string | number | Function;

type DeepRequired<T> = T extends Primitive
  ? NotNill<T>
  : {
    [P in keyof T]-?: T[P] extends Array<infer U>
    ? Array<DeepRequired<U>>
    : T[P] extends ReadonlyArray<infer U2>
    ? DeepRequired<U2>
    : DeepRequired<T[P]>
  };

export interface Dependency {
  packageJson: NormalizedPackageJson
  licenseText: string
}

export interface Options {
  banner?: string
  thirdParty?: {
    /**
     * @default false
     */
    includePrivate?: boolean
    output?: {
      file?: string
      /**
       * Template function that can be defined to customize report output
       * Format of https://lodash.com/docs/4.17.15#template
       */
      template?: string | ((dependencies: Dependency[], self: Dependency) => string)
    }
  }
}

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

export default function esbuildPluginLicense(options: Options = {}): Plugin {
  const loadedPackages: Map<string, NormalizedReadResult> = new Map()
  const dependencies: Dependency[] = []
  const getLicenseText = async (pkgJsonPath: string) => {
    const dir = path.dirname(pkgJsonPath)
    const files = await fs.readdir(dir)
    const idx = files.findIndex(file => {
      if (file.toLocaleLowerCase().includes('license'))
        return true
      else return false
    })
    if (idx !== -1) {
      return (await fs.readFile(path.join(dir, files[idx]))).toString()
    }
    return ''
  }
  return {
    name: 'esbuild-plugin-license',
    async setup(build) {
      const pkg = await readPackageUp()
      const banner = options.banner || defaultOptions.banner

      build.initialOptions.banner = {
        ...build.initialOptions.banner,
        js: (build.initialOptions.banner?.js ?? '') + _.template(banner)({ pkg: pkg?.packageJson })
      }

      build.onLoad({ filter: /.*/ }, async (args) => {
        const result = await readPackageUp({
          cwd: path.dirname(args.path)
        })
        if (result) {
          loadedPackages.set(result.packageJson.name, result)
        }
        return null
      })
      build.onEnd(async () => {
        const includePrivate = options.thirdParty?.includePrivate ?? defaultOptions.thirdParty.includePrivate

        for await (const [name, result] of ([...loadedPackages.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1))) {
          if (!includePrivate && result.packageJson.private) continue
          if (!name) continue

          dependencies.push({
            packageJson: result.packageJson,
            licenseText: await getLicenseText(result.path)
          })
        }

        // generate thirdParty output
        const output = options.thirdParty?.output ?? defaultOptions.thirdParty.output
        let outputFile = output.file ?? defaultOptions.thirdParty.output.file
        const outputTemplate = output.template ?? defaultOptions.thirdParty.output.template

        const outdir = build.initialOptions.outdir ?? '.'
        if (!path.isAbsolute(outputFile)) outputFile = path.join(outdir, outputFile)

        let thirdPartyLicenseResult = ''
        if (typeof outputTemplate === 'string') {
          thirdPartyLicenseResult = _.template(outputTemplate)(dependencies)
        } else {
          thirdPartyLicenseResult = outputTemplate(dependencies, {
            packageJson: pkg!.packageJson,
            licenseText: await getLicenseText(pkg!.path)
          })
        }
        await fs.writeFile(outputFile, thirdPartyLicenseResult, {
          encoding: 'utf-8'
        })
      })
    }
  }
}
