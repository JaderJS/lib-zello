import { Stream } from "./services/stream"
import { ZelloAuth } from "./services/auth"
import { WebSocket } from "ws"
import { config } from "../config"
import OpusFileStream from "./services/opus"


export class Zello {
    protected zelloStreamId?: number
    protected zelloSocket?: any

    protected stream: Stream
    protected auth: ZelloAuth
    protected ws: WebSocket

    public IsConnected = false

    protected refreshToken?: string

    constructor({ url }: { url: string }) {
        this.stream = new Stream()
        this.auth = new ZelloAuth()
        this.ws = new WebSocket(url)

        this.ws.onerror = () => {
            console.error("WebSocket error")
            this.ws.close()
        }

        this.ws.onclose = () => {
            if (this.zelloStreamId) {
                console.error("Connection has been closed unexpectedly")
            }
        }

        process.on("SIGINT", () => {
            console.log("Usuário encerrou a conexão")
            this.ws.close()
        })

        // this.getRefreshToken()
    }

    receivedAudio() {

        console.log("received audio enabled", this.IsConnected)

        this.ws.onmessage = (event) => {
            try {
                console.log("RECEIVED", event.data)
                const json = JSON.parse(event.data as string)
                if (json.command === "on_stream_start") {
                    this.zelloStreamId = json.stream_id
                    console.log("Received audio de ", json.from, "streamId: ", json.stream_id)
                } else if (json.command === "on_stream_stop") {
                    console.log("Stop audio")
                }

            } catch (error) {
                return
            }
        }

        this.ws.send(JSON.stringify({
            "command": "start_stream",
            "seq": 2,
            "type": "audio",
            "channel": "LinkRadioLtda",
            "codec": "opus",
        }))

    }

    async sendAudio(filename: string) {

        if (!this.IsConnected) {
            await this.getRefreshToken()
        }

        const opusStream = await new Promise<OpusFileStream | null | undefined>((resolve) => {
            new OpusFileStream(filename, (stream) => {
                resolve(stream)
            })
        })

        if (!opusStream) {
            return
        }

        await new Promise<void>((resolve) => {
            const checkConnection = () => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    resolve()
                } else {
                    setTimeout(checkConnection, 100)
                }
            }
            checkConnection()
        })

        try {

            const streamId = await new Promise<any>((resolve, reject) => this.stream.startStreamAudio(this.ws, opusStream, (streamId) => {
                if (!streamId) {
                    reject("Error getting stream id")
                    this.ws.close()
                }
                resolve(streamId)
            }))
            console.log("Started streaming " + opusStream.filename)

            this.stream.sendStreamAudio(this.ws, opusStream, streamId, (success) => {
                if (!success) {
                    console.error("Failed to stream audio")
                }

                this.stream.stopStreamAudio(this.ws, streamId)
                console.log("Closed stream " + streamId)
            })



        } catch (error) {
            console.error("Ocorreu um erro durante o streaming de áudio:", error)
        }

    }

    async getRefreshToken() {

        await new Promise<void>((resolve) => {
            const checkConnection = () => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    resolve()
                } else {
                    console.log("Rechecking connection")
                    setTimeout(checkConnection, 1000)
                }
            }
            checkConnection()
        })

        const refresh_token = await new Promise<string>((resolve, reject) => {
            this.auth.authorized(this.ws, { ...config }, (json) => {
                if (json?.refresh_token) {
                    this.refreshToken = json.refresh_token
                    this.IsConnected = true
                    resolve(json.refresh_token)
                }

            })
        })

        // this.receivedAudio()

        return refresh_token
    }



}