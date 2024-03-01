import fs from "node:fs"
import path from "node:path"

import { sign } from "jsonwebtoken"
import { config } from "../../config"
import { WebSocket } from "ws"

type ConfigProps = {
    username: string
    password: string
    channel: string[]
}

class ZelloAuth {

    private authTimeMs = 2000
    public isAuthorized = false
    public isChannelAvailable = false
    private token: string | undefined

    constructor() {

        const privateKey = fs.readFileSync(path.join(__dirname, "../../", "key.pem"), { encoding: "utf-8" })
        const token = sign({ iss: config.issuer, exp: Math.floor(Date.now() / 1000) + 120 }, privateKey, { algorithm: "RS256" })
        this.token = token


    }

    async authorized(ws: WebSocket, config: ConfigProps, onCompleted: (event: any) => void) {

        if (!this.token || !config) {
            console.error("Missing params")
        }

        ws.send(JSON.stringify({
            seq: 1,
            command: "logon",
            auth_token: this.token,
            username: config.username,
            password: config.password,
            channel: config.channel
        }))

        const authTimeout = setTimeout(onCompleted, this.authTimeMs, false)

        ws.onmessage = (event) => {

            this.isAuthorized = false
            this.isChannelAvailable = false
            try {
                const json = JSON.parse(event.data as string)
                if (json.refresh_token) {
                    this.isAuthorized = true
                } else if (json.command === "on_channel_status" && json.status === "online") {
                    this.isChannelAvailable = true
                } else if (json.command === "on_stream_start") {
                    console.log(json)
                }
                clearTimeout(authTimeout)
                return onCompleted(json)

            } catch (error) {
                return
            }



        }
    }
}



export { ZelloAuth }