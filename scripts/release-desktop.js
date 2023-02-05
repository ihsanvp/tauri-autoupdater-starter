const minimist = require("minimist")
const semver = require("semver")
const path = require("path")
const fs = require("fs/promises")
const { spawnSync } = require("child_process")

const VERSIONS = ["major", "minor", "patch"]
const CWD = path.resolve(process.cwd())
const PROJECT_PATH = path.resolve(process.cwd(), "apps/desktop")
const PROJECT_TAURI_PATH = path.resolve(process.cwd(), "apps/desktop/src-tauri")
const NPM_PATH = path.resolve(PROJECT_PATH, "package.json")

async function main() {
    const args = minimist(process.argv.slice(2))._

    if (args.length != 1) {
        console.error("please specify <version> | [major|minor|patch]")
        process.exit(1)
    }

    const versionType = args[0]

    if (!VERSIONS.includes(versionType)) {
        console.error(`unknown version '${versionType}'. version should  any of [major|minor|patch]`)
        process.exit(1)
    }

    const checkBranch = await runGitCommand("branch", "--show-current")

    if (checkBranch.result != "main") {
        console.error("not in 'main' branch")
        console.error("switch to 'main' branch and try again")
        process.exit(1)
    }

    const version = await bumpNPM(versionType)

    await bumpCargo(version.new, version.old).catch(async err => await restoreNPM(version.old))
    await runGitCommand("add", "--all")
    await runGitCommand("commit", "-m", `v${version.new}`)
    await runGitCommand("tag", `v${version.new}`)
    await runGitCommand("push", "--tags")
}

async function bumpNPM(versionType) {
    console.log("bumping npm version...")

    const content = JSON.parse(await fs.readFile(NPM_PATH))
    const old_version = content.version
    const new_version = semver.inc(old_version, versionType)

    content.version = new_version
    await fs.writeFile(NPM_PATH, JSON.stringify(content, null, "\t"))

    return {
        old: old_version,
        new: new_version
    }
}

async function restoreNPM(version) {
    const content = JSON.parse(await fs.readFile(NPM_PATH))

    content.version = version
    await fs.writeFile(NPM_PATH, JSON.stringify(content, null, "\t"))
}

async function bumpCargo(version) {
    return new Promise((res, rej) => {
        console.log("bumping cargo version...")

        const p = spawnSync("cargo", ["bump", version], {
            cwd: PROJECT_TAURI_PATH,
            shell: true
        })

        if (p.status != 0) {
            console.error("cargo bump failed")
            rej("cargo bump failed")
            return
        }

        res()
    })
}

async function runGitCommand(...args) {
    return new Promise((res, rej) => {
        console.log(`running: 'git ${args.join(" ")}'`)

        const p = spawnSync("git", args, {
            cwd: CWD,
            shell: true
        })

        if (p.status != 0) {
            console.error(`failed: '${args.join(" ")}'`)
        }

        res({
            result: p.stdout.toString().trim(),
            error: p.stderr.toString().trim()
        })
    })
}

main()