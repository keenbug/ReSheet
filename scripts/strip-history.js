// Strip the history from a saved Tables document
const fs = require('fs').promises

async function readFileAndParseJson(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8')
    const document = JSON.parse(data)
    const state = document.inner
    console.log(JSON.stringify({ history: [{ time: 0, state }], inner: state }))
  }
  catch (err) {
    console.error(`Error stripping history: ${err.message}`)
  }
}

const filePath = process.argv[2]

if (!filePath) {
  console.error('Usage: node strip-history.js tables-document.json [ > stripped-document.json ]')
}
else {
  readFileAndParseJson(filePath)
}
