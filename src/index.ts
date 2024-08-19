import { Plugin } from 'esbuild';
import * as _ from 'lodash-es'
import path from 'path';
import { NormalizedReadResult, readPackageUp } from 'read-pkg-up'
import normalize from 'normalize-package-data'
import type { PackageJson } from 'type-fest'
import fs from 'fs'
type Package = normalize.Package
type NormalizedPackageJson = Package & PackageJson

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

export type TemplateFunction = (dependencies: Dependency[], self: Dependency) => string

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
      template?: string | TemplateFunction
    }
  }
}

const getAuthorDescription = (author: NormalizedPackageJson['author']): string | null => {
  if (author === undefined) return null
  if (typeof author === 'string') return author
  let authorDescription = author.name
  if (author.email) authorDescription += ` <${author.email}>`
  if (author.url) authorDescription += ` (${author.url})`

  return authorDescription
}

export const defaultTemplateFunction: TemplateFunction = (dependencies) => {
    const licensesJSON = dependencies
      .map((dependency) => {
        const name = dependency.packageJson.name ?? '';
        const version = dependency.packageJson.version;
        const licenseText = dependency.licenseText
        const author = getAuthorDescription(dependency.packageJson.author)
        const license = dependency.packageJson.license ?? null;
        const repository = dependency.packageJson.repository?.url ?? null;

        return {
          name,
          version,
          licenseText,
          ...(author === null ? {} : { author }),
          ...(license === null ? {} : { license }),
          ...(repository === null ? {} : { repository }),
        };
      })

  return JSON.stringify(licensesJSON, null, 2);
}

export const defaultOptions: DeepRequired<Options> = {
  banner: `/*! <%= pkg.name %> v<%= pkg.version %> | <%= pkg.license %> */`,
  thirdParty: {
    includePrivate: false,
    output: {
      file: 'oss-licenses.json',
      template: defaultTemplateFunction,
    }
  }
} as const

export default function esbuildPluginLicense(options: Options = {}): Plugin {
  const loadedPackages: Map<string, NormalizedReadResult> = new Map()
  const dependencies: Dependency[] = []
  const getLicenseText = async (pkgJsonPath: string) => {
    const dir = path.dirname(pkgJsonPath)
    const files = fs.readdirSync(dir)
    const idx = files.findIndex(file => {
      if (file.toLocaleLowerCase().includes('license'))
        return true
      else return false
    })
    if (idx !== -1) {
      return (fs.readFileSync(path.join(dir, files[idx]))).toString()
    }
    return ''
  }
  return {
    name: 'esbuild-plugin-license',
    async setup(build) {
      const pkg = await readPackageUp()
      const banner = options.banner || defaultOptions.banner

      let userBanner = build.initialOptions.banner?.js
      userBanner = userBanner ? (userBanner + '\n') : ''
      build.initialOptions.banner = {
        ...build.initialOptions.banner,
        js: userBanner + _.template(banner)({ pkg: pkg?.packageJson })
      }

      build.onLoad({ filter: /.*/ }, async (args) => {
        const result = await readPackageUp({
          cwd: path.dirname(args.path)
        })
        if (result) {
          // Only keep the latest version of the dependency
          if (loadedPackages.has(result.packageJson.name)) {
            const oldVersion = loadedPackages.get(result.packageJson.name)?.packageJson.version
            if (!oldVersion || (oldVersion < result.packageJson.version)) {
              loadedPackages.set(result.packageJson.name, result)
            }
          } else {
            loadedPackages.set(result.packageJson.name, result)
          }
        }
        return null
      })
      build.onEnd(async () => {
        const includePrivate = options.thirdParty?.includePrivate ?? defaultOptions.thirdParty.includePrivate

        for await (const [name, result] of ([...loadedPackages.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1))) {
          if (!includePrivate && result.packageJson.private) continue
          if (!name) continue
          if (result.packageJson.name === pkg?.packageJson.name) continue

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
        if (thirdPartyLicenseResult) {
          fs.writeFileSync(outputFile, thirdPartyLicenseResult, {
            encoding: 'utf-8'
          })
        }
      })
    }
  }
}

