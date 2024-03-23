import { storeBackup } from "./backup"

onmessage = async (event) => {
    console.log('starting backup')
    await storeBackup(event.data.id, event.data.document)
    console.log('finished backup')
    postMessage({ done: event.data.ref })
}