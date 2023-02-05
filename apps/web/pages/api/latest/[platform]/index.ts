// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'
import semver from "semver"
import { Octokit } from "@octokit/rest"

type ResponseData = {
    version: string
    url: string,
    name: string
}

enum Platform {
    windows = "windows",
    mac = "mac",
    linux = "linux"
}
type Extensions = { [key in Platform]: string }

const _15MINS = 60 * 15
const OWNER = "ihsanvp"
const REPO = "credo"

const EXTENSIONS: Extensions = {
    windows: "x64_en-US.msi",
    mac: "x64.dmg",
    linux: "amd64.AppImage"
}

async function getDownloadResponse(platform: Platform): Promise<ResponseData> {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const { data: release } = await octokit.repos.getLatestRelease({
        owner: OWNER,
        repo: REPO
    })

    const latest_version = semver.clean(release.tag_name) as string
    const asset = release.assets.find(a => a.name.includes(EXTENSIONS[platform]))

    if (!asset) {
        throw new Error(`latest version for platform '${platform}' not found`)
    }

    return {
        version: latest_version,
        url: asset.browser_download_url,
        name: asset.name
    }
}


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<ResponseData | string>
) {
    try {
        const platform = req.query.platform as Platform

        if (!Object.values(Platform).includes(platform)) {
            throw new Error("unsupported platform")
        }
        const download = await getDownloadResponse(platform)

        res.setHeader("Cache-Control", `s-maxage=${_15MINS}, stale-while-revalidate=${_15MINS}`)
        res.status(200).json(download)

    } catch (err) {
        console.log(err)
        res.status(400).send(err as string)
    }

}
