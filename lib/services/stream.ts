import { ZelloAuth } from "./auth";

import { WebSocket } from "ws";
import OpusFileStream from "./opus";

export class Stream extends ZelloAuth {

    startStreamAudio(ws: WebSocket, opusStream: any, onCompleted: (data: number | undefined) => void) {
        // let codecHeaderRaw = Buffer.alloc(4)

        // codecHeaderRaw.writeUInt8(opusStream.sampleRate & 0xff, 0);
        // codecHeaderRaw.writeUInt8((opusStream.sampleRate / 0x100) & 0xff, 1);
        // codecHeaderRaw.writeUInt8(opusStream.framesPerPacket, 2);
        // codecHeaderRaw.writeUInt8(opusStream.packetDurationMs, 3);

        let codecHeaderRaw = new Uint8Array(4)
        codecHeaderRaw[2] = opusStream.framesPerPacket
        codecHeaderRaw[3] = opusStream.packetDurationMs
        codecHeaderRaw[0] = parseInt(opusStream.sampleRate as any & 0xff, 10)
        codecHeaderRaw[1] = parseInt(opusStream.sampleRate / 0x100 as any, 10) & 0xff

        const codecHeader = Buffer.from(codecHeaderRaw).toString('base64')

        ws.send(JSON.stringify({
            "command": "start_stream",
            "seq": 2,
            "type": "audio",
            "channel": "LinkRadioLtda",
            "codec": "opus",
            "codec_header": codecHeader,
            "packet_duration": opusStream.packetDurationMs,
        }))

        const startTimeoutMs = 2000
        const startTimeout = setTimeout(onCompleted, startTimeoutMs, null)

        ws.onmessage = (event) => {
            try {
                console.log("START_STREAM", event.data)
                const json = JSON.parse(event.data as string)
                if (json.success && json.stream_id) {
                    clearTimeout(startTimeout)
                    return onCompleted(json.stream_id)
                } else if (json.error) {
                    console.log("Got an error: " + json.error)
                    clearTimeout(startTimeout)
                    return onCompleted(undefined)
                }
            } catch (e) {
                return
            }
        }
    }

    getCurrentTimeMs() {
        const now = new Date();
        return now.getTime();
    }

    zelloGenerateAudioPacket(data: any, streamId: any, packetId: any) {
        // https://github.com/zelloptt/zello-channel-api/blob/master/API.md#stream-data
        let packet = new Uint8Array(data.length + 9);
        packet[0] = 1;

        let id = streamId;
        for (let i = 4; i > 0; i--) {
            packet[i] = parseInt(id as any & 0xff, 10);
            id = parseInt(id as any / 0x100 as any, 10);
        }

        id = packetId;
        for (let i = 8; i > 4; i--) {
            packet[i] = parseInt(id as any & 0xff, 10);
            id = parseInt(id / 0x100 as any, 10);
        }
        packet.set(data, 9);
        return packet;
    }


    sendStreamAudio(ws: WebSocket, opusStream: OpusFileStream, streamId: number, onCompleted: (data: any) => void) {
        const startMs = this.getCurrentTimeMs()
        let timeStreamingMs = 0
        let packetId = 0

        const zelloStreamNextPacket = () => {
            opusStream.getNextOpusPacket(null, false, (data: any) => {
                if (!data) {
                    console.log("Audio stream is over")
                    return onCompleted(true)
                }
                const packet = this.zelloGenerateAudioPacket(data, streamId, packetId)
                timeStreamingMs += opusStream.packetDurationMs
                packetId++
                this.zelloSendAudioPacket(ws, packet, startMs, timeStreamingMs, () => {
                    return zelloStreamNextPacket()
                })
            })
        }

        zelloStreamNextPacket()
        ws.onmessage = () => {
            return
        }

    }

    zelloSendAudioPacket(ws: WebSocket, packet: any, startTsMs: number, timeStreamingMs: any, onCompleteCb: () => void) {
        const timeElapsedMs = this.getCurrentTimeMs() - startTsMs;
        const sleepDelayMs = timeStreamingMs - timeElapsedMs;

        ws.send(packet);
        if (sleepDelayMs < 1) {
            return onCompleteCb();
        }
        setTimeout(onCompleteCb, sleepDelayMs);
    }

    stopStreamAudio(ws: WebSocket, streamId: number, zelloStreamId?: number) {

        ws.send(JSON.stringify({
            command: "stop_stream",
            stream_id: streamId
        }))

        zelloStreamId = undefined;
    }




}

