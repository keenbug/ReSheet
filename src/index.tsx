import * as React from 'react'
import ReactDOM from 'react-dom'

import 'prismjs/themes/prism.css'

import { CommandBlock } from './blocks/command'
import { ErrorBoundary } from './ui/value'
import { library } from './utils/std-library'


/****************** Main Application ******************/

const commandLibrary = library

const ToplevelBlock = CommandBlock(library.blocks)

const loadSavedState = () => {
    try {
        const savedJson = JSON.parse(localStorage.getItem('block'))
        return ToplevelBlock.fromJSON(savedJson, commandLibrary)
    }
    catch (e) {
        console.warn("Could not load saved state:", e)
        return ToplevelBlock.init
    }
}

const App = () => {
    const [state, setState] = React.useState<any>(loadSavedState)

    React.useEffect(() => {
        localStorage.setItem('block', JSON.stringify(state))
    }, [state])

    return (
        <React.Fragment>
            <ErrorBoundary title="There was an Error in the REPL">
                <div className="flex flex-col space-y-4" style={{ marginBottom: '100vh' }}>
                    {ToplevelBlock.view({ state, setState, env: commandLibrary })}
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