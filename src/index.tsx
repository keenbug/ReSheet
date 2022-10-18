import * as React from 'react'
import ReactDOM from 'react-dom'

import 'prismjs/themes/prism.css'

import { CommandBlock } from './blocks/command'
import { ErrorBoundary, ErrorInspector } from './ui/value'
import { library } from './utils/std-library'
import { ErrorView } from './ui/utils'


/****************** Main Application ******************/

const ToplevelBlock = CommandBlock(library.blocks)

const loadSavedState = () => {
    try {
        const savedJson = JSON.parse(localStorage.getItem('block'))
        return ToplevelBlock.fromJSON(savedJson, library)
    }
    catch (e) {
        console.warn("Could not load saved state:", e)
        return ToplevelBlock.init
    }
}

const App = () => {
    const [state, setState] = React.useState<any>(loadSavedState)
    const [updateError, setUpdateError] = React.useState<null | Error>(null)
    const [savingError, setSavingError] = React.useState<null | Error>(null)

    const saveUpdate = action => {
        setState(state => {
            try {
                return action(state)
            }
            catch (error) {
                setUpdateError(error)
                return state
            }
        })
    }

    React.useEffect(() => {
        try {
            const stateAsJson = ToplevelBlock.toJSON(state)
            localStorage.setItem('block', JSON.stringify(stateAsJson))
        }
        catch (error) { setSavingError(error) }
    }, [state])

    return (
        <React.Fragment>
            <ViewInternalError
                title="Could not save current state"
                error={savingError}
                onDismiss={() => setSavingError(null)}
            />
            <ViewInternalError
                title="Last action could not be completed"
                error={updateError}
                onDismiss={() => setUpdateError(null)}
            />
            <ErrorBoundary title="There was an Error in the REPL">
                {ToplevelBlock.view({
                    state,
                    update: saveUpdate,
                    env: library
                })}
            </ErrorBoundary>
        </React.Fragment>
    )
}


const ViewInternalError = ({ title, error, onDismiss }) => {
    if (error === null) { return null }

    return (
        <ErrorView title={"Internal Error: " + title} error={error}>
            <button onClick={onDismiss}>Dismiss</button>
            <ErrorInspector error={error} />
        </ErrorView>
    )
}




/*** Script ***/

ReactDOM.render(
    <App />,
    document.getElementById('app'),
)