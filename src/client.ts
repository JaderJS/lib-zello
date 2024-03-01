// import { token } from "../lib/services/auth";
import { WebSocket } from "ws";
import { config } from "../config";
import { ZelloAuth } from "../lib/services/auth"
import { Zello } from "../lib/zello";


const z = new Zello({ url: "wss://Zello.io/ws" })

const main = () => {

    z.sendAudio("proj5xwgl970xzz7c3jmqsfe.opus")

    // z.sendAudio("sample.opus")
    // z.receivedAudio()

}



main()