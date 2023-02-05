// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import semver from "semver"
import { Octokit } from "@octokit/rest"

type ResponseData = {
    version: string
    notes: string
    pub_date: string
    platforms: PlatformData
}

type PlatformData = {
    [key: string]: {
        url: string
        signature: string
    }
}

const _15MINS = 60 * 15
const OWNER = "ihsanvp"
const REPO = "credo"

const EXTENSIONS = {
    windows: "x64_en-US.msi.zip",
    macos: "app.tar.gz",
    linux: "amd64.AppImage.tar.gz"
}

const PLATFORMS = [
    // windows
    ["windows-x86_64", EXTENSIONS.windows],

    // macos
    ["darwin-x86_64", EXTENSIONS.macos],
    ["darwin-aarch64", EXTENSIONS.macos],

    // linux
    ["linux-x86_64", EXTENSIONS.linux],
]

async function getUpdateResponse(): Promise<ResponseData> {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const { data: release } = await octokit.repos.getLatestRelease({
        owner: OWNER,
        repo: REPO
    })

    const latest_version = semver.clean(release.tag_name) as string
    const notes = release.body as string
    const pub_date = new Date(release.published_at as string).toISOString()

    const platformsArray = []

    for (const [arch, extension] of PLATFORMS) {
        let url = ""
        let signature = ""

        const asset = release.assets.find(a => a.name.includes(extension))

        if (asset) {
            url = asset.browser_download_url
            const sig = release.assets.find(a => a.name.includes(extension + ".sig"))

            if (sig) {
                const res = await fetch(sig.browser_download_url)
                signature = await res.text()
            }
        }

        platformsArray.push([arch, { url, signature }])
    }

    return {
        version: latest_version,
        notes,
        pub_date,
        platforms: Object.fromEntries(platformsArray)
    }

}


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData | string>
) {
    try {
        const current_version = req.query.current_version as string
        const update = await getUpdateResponse()

        if (semver.compare(update.version, current_version) <= 0) {
            throw new Error("already up to date")
        }

        res.setHeader("Cache-Control", `s-maxage=${_15MINS}, stale-while-revalidate=${_15MINS}`)
        res.status(200).json(update)

    } catch (err) {
        console.log(err)
        res.status(204).send("")
    }

}
