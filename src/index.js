import React from 'react'
import ReactDOM from 'react-dom'

import 'prismjs/themes/prism.css'

import { CommandBlock } from './blocks/command'
import { ErrorBoundary } from './ui/value'
import stdLibrary, { library } from './utils/std-library'


/****************** Main Application ******************/

const commandLibrary = { ...stdLibrary, ...library.blocks }

const ToplevelBlock = CommandBlock(commandLibrary)

const loadSavedBlock = () => {
    try {
        const savedJson = JSON.parse(localStorage.getItem('block'))
        return ToplevelBlock.fromJSON(savedJson)
    }
    catch (e) {
        console.warn("Could not load saved state:", e)
        return ToplevelBlock
    }
}

const App = () => {
    const [block, setBlock] = React.useState(loadSavedBlock)

    React.useEffect(() => {
        localStorage.setItem('block', JSON.stringify(block))
    }, [block])

    return (
        <React.Fragment>
            <ErrorBoundary title="There was an Error in the REPL">
                <div className="flex flex-col space-y-4" style={{ marginBottom: '100vh' }}>
                    {block.render(setBlock)}
                </div>
            </ErrorBoundary>
        </React.Fragment>
    )
}




/*** Script ***/

ReactDOM.render(
    <App />,
    document.getElementById('app'),
)