import { storeBackup } from "./backup"

onmessage = async (event) => {
    await storeBackup(event.data.id, event.data.document)
    postMessage({ done: event.data.ref })
}