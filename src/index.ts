import * as fs from 'fs'
import * as path from 'path'

async function existsAsync(path: string): Promise<boolean> {
  return fs.promises
    .stat(path)
    .then(() => true)
    .catch(() => false)
}

const packageManagerNames = ['npm', 'yarn', 'pnpm', 'bun'] as const
export type PackageManagerName = (typeof packageManagerNames)[number]

/**
 * @description Look for the most recently added package manager, which is most likely non-existent.
 */
const lockfileNames: Record<PackageManagerName, string> = {
  bun: 'bun.lockb',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  npm: 'package-lock.json',
}

export type FindOptions = {
  /**
   * The current working directory in which to search for the lockfile.
   * @default process.cwd()
   */
  cwd?: string
}

function resolveOptions(options?: FindOptions): Required<FindOptions> {
  return {
    cwd: process.cwd(),
    ...options,
  }
}

export type FindResult = {
  packageManagerName: PackageManagerName
}

class NotFoundError extends Error {
  constructor() {
    super('No package manager was found.')
  }
}

type FinderOptions = Readonly<Required<FindOptions>>

interface Finder {
  findSync(options: FinderOptions): FindResult | null
  find(options: FinderOptions): Promise<FindResult | null>
}

class PackageJsonFinder implements Finder {
  static readonly pattern = /^(?<name>[^@]+)(?:@.+)?$/

  findSync(options: FinderOptions): FindResult | null {
    const { cwd } = options
    const jsonPath = this.jsonPath(cwd)
    if (!fs.existsSync(jsonPath)) {
      return null
    }

    const content = fs.readFileSync(jsonPath, 'utf8')
    const packageManagerValue = this.parsePackageManagerValueFromJson(content)
    if (!packageManagerValue) {
      return null
    }

    const packageManagerName =
      this.parsePackageManagerValuePattern(packageManagerValue)
    if (!packageManagerName) {
      return null
    }

    return {
      packageManagerName,
    }
  }

  async find(options: FinderOptions): Promise<FindResult | null> {
    const { cwd } = options
    const jsonPath = this.jsonPath(cwd)
    if (!(await existsAsync(jsonPath))) {
      return null
    }

    const content = await fs.promises.readFile(jsonPath, 'utf8')
    const packageManagerValue = this.parsePackageManagerValueFromJson(content)
    if (!packageManagerValue) {
      return null
    }

    const packageManagerName =
      this.parsePackageManagerValuePattern(packageManagerValue)
    if (!packageManagerName) {
      return null
    }

    return {
      packageManagerName,
    }
  }

  private jsonPath(cwd: string): string {
    return path.resolve(cwd, 'package.json')
  }

  private parsePackageManagerValueFromJson(content: string): string | null {
    const packageJson = JSON.parse(content)
    if (!packageJson) {
      return null
    }

    if (!packageJson.packageManager) {
      return null
    }

    return packageJson.packageManager
  }

  private parsePackageManagerValuePattern(
    value: string,
  ): PackageManagerName | null {
    const match = value.match(PackageJsonFinder.pattern)
    if (!match) {
      return null
    }

    if (!match.groups) {
      return null
    }

    const { name } = match.groups
    if (!name) {
      return null
    }

    if (!packageManagerNames.includes(name as PackageManagerName)) {
      return null
    }

    return name as PackageManagerName
  }
}

class LockfileFinder implements Finder {
  findSync(options: FinderOptions): FindResult | null {
    const { cwd } = options
    for (const [packageManagerNameRaw, lockfileName] of Object.entries(
      lockfileNames,
    )) {
      const packageManagerName = packageManagerNameRaw as PackageManagerName
      const lockfilePath = path.resolve(cwd, lockfileName)
      if (fs.existsSync(lockfilePath)) {
        return {
          packageManagerName,
        }
      }
    }

    return null
  }

  async find(options: FinderOptions): Promise<FindResult | null> {
    const { cwd } = options
    for (const [packageManagerNameRaw, lockfileName] of Object.entries(
      lockfileNames,
    )) {
      const packageManagerName = packageManagerNameRaw as PackageManagerName
      const lockfilePath = path.resolve(cwd, lockfileName)
      if (await existsAsync(lockfilePath)) {
        return {
          packageManagerName,
        }
      }
    }

    return null
  }
}

const finders: Finder[] = [new PackageJsonFinder(), new LockfileFinder()]

export function findSync(options?: FindOptions): FindResult {
  const resolvedOptions = resolveOptions(options)
  for (const finder of finders) {
    const result = finder.findSync(resolvedOptions)
    if (result) {
      return result
    }
  }

  throw new NotFoundError()
}

export async function find(options?: FindOptions): Promise<FindResult> {
  const resolvedOptions = resolveOptions(options)
  for (const finder of finders) {
    const result = await finder.find(resolvedOptions)
    if (result) {
      return result
    }
  }

  throw new NotFoundError()
}
