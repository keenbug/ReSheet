import * as React from 'react'
import ReactDOM from 'react-dom/client'

import 'prismjs/themes/prism.css'

import { ErrorBoundary, ErrorInspector } from './ui/value'
import { library } from './utils/std-library'
import { ErrorView } from './ui/utils'
import { DocumentBlock, DocumentState } from './blocks/document'
import { CommandBlock, CommandState } from './blocks/command'


const blocks = library.blocks

type ToplevelBlockState = DocumentState<CommandState>
const ToplevelBlock = DocumentBlock(CommandBlock('', null, blocks.StateEditor(blocks), blocks))


/****************** Main Application ******************/

const App = () => {
    const [state, setState] = React.useState<ToplevelBlockState>(ToplevelBlock.init)
    const [updateError, setUpdateError] = React.useState<null | Error>(null)

    const safeUpdate = action => {
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

    const viewToplevelBlock = () => {
        return ToplevelBlock.view({
            state: state,
            update: safeUpdate,
            env: library,
        })
    }

    return (
        <React.Fragment>
            <ViewInternalError
                title="Last action could not be completed"
                error={updateError}
                onDismiss={() => setUpdateError(null)}
            />
            <ErrorBoundary title="There was an Error in the Toplevel Block">
                {viewToplevelBlock()}
            </ErrorBoundary>
        </React.Fragment>
    )
}



const ViewInternalError = ({ title, error, onDismiss }) => {
    if (error === null) { return null }

    return (
        <ErrorView title={"Internal Error: " + title} error={error} className="sticky top-1 my-1 z-20 shadow-lg">
            <button onClick={onDismiss}>Dismiss</button>
            <ErrorInspector error={error} />
        </ErrorView>
    )
}




/*** Script ***/

const root = ReactDOM.createRoot(document.getElementById('app'))
root.render(<App />)