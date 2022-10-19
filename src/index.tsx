import * as React from 'react'
import ReactDOM from 'react-dom'

import 'prismjs/themes/prism.css'

import { CommandBlock, CommandModel } from './blocks/command'
import { ErrorBoundary, ErrorInspector } from './ui/value'
import { library } from './utils/std-library'
import { ErrorView } from './ui/utils'
import produce, { original } from 'immer'


type ViewState =
    | { mode: 'current' }
    | { mode: 'history', position: number }

interface ApplicationState {
    blockState: ToplevelBlockState
    history: Array<{
        time: Date
        blockState: ToplevelBlockState
    }>
    viewState: ViewState
}

type ToplevelBlockState = CommandModel
const ToplevelBlock = CommandBlock(library.blocks)


const initApplicationState = (initBlockState: ToplevelBlockState): ApplicationState => {
    return {
        blockState: initBlockState,
        history: [{ time: new Date(), blockState: initBlockState }],
        viewState: { mode: 'current' },
    }
}


/****************** Main Application ******************/

const loadSavedState = () => {
    try {
        const savedJson = JSON.parse(localStorage.getItem('block'))
        return initApplicationState(ToplevelBlock.fromJSON(savedJson, library))
    }
    catch (e) {
        console.warn("Could not load saved state:", e)
        return initApplicationState(ToplevelBlock.init)
    }
}

const App = () => {
    const [state, setState] = React.useState<ApplicationState>(loadSavedState)
    const [updateError, setUpdateError] = React.useState<null | Error>(null)
    const [savingError, setSavingError] = React.useState<null | Error>(null)

    const saveUpdate = action => {
        setState(produce(state => {
            try {
                const newBlockState = action(original(state).blockState)
                state.blockState = newBlockState
                state.history.push({ time: new Date(), blockState: newBlockState })
            }
            catch (error) {
                setUpdateError(error)
            }
        }))
    }

    const onOpenHistory = () => {
        setState(produce(state => {
            if (state.history.length > 0) {
                state.viewState = {
                    mode: 'history',
                    position: state.history.length - 1,
                }
            }
        }))
    }

    const onGoBack = () => {
        setState(produce(state => {
            if (state.viewState.mode === 'history') {
                state.viewState.position = Math.max(0, state.viewState.position - 1)
            }
        }))
    }

    const onGoForward = () => {
        setState(produce(state => {
            if (state.viewState.mode === 'history') {
                state.viewState.position++
                if (state.viewState.position >= state.history.length) {
                    state.viewState = { mode: 'current' }
                }
            }
        }))
    }

    const onUseState = () => {
        setState(produce(state => {
            if (state.viewState.mode === 'history') {
                const historicState = original(state).history[state.viewState.position]
                state.history.push(historicState)
                state.blockState = historicState.blockState
                state.viewState = { mode: 'current' }
            }
        }))
    }

    React.useEffect(() => {
        try {
            const stateAsJson = ToplevelBlock.toJSON(state.blockState)
            localStorage.setItem('block', JSON.stringify(stateAsJson))
        }
        catch (error) { setSavingError(error) }
    }, [state.blockState])

    const viewToplevelBlock = () => {
        switch (state.viewState.mode) {
            case 'current':
                return ToplevelBlock.view({
                    state: state.blockState,
                    update: saveUpdate,
                    env: library
                })
            
            case 'history':
                const stateInHistory = state.history[state.viewState.position].blockState
                return ToplevelBlock.view({
                    state: stateInHistory,
                    update: () => {},
                    env: library,
                })
        }
    }

    return (
        <React.Fragment>
            <MenuBar
                viewState={state.viewState}
                history={state.history}
                onOpenHistory={onOpenHistory}
                onGoBack={onGoBack}
                onGoForward={onGoForward}
                onUseState={onUseState}
                />
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
                {viewToplevelBlock()}
            </ErrorBoundary>
        </React.Fragment>
    )
}


const MenuBar = ({ viewState, history, onOpenHistory, onGoBack, onGoForward, onUseState }) => {
    // TODO styling
    switch (viewState.mode) {
        case 'current':
            return (
                <div>
                    <button onClick={onOpenHistory}>Back</button>
                </div>
            )
        case 'history':
        default:
            return (
                <div>
                    <button onClick={onGoBack}>Back</button>
                    {history[viewState.position].time.toString()}
                    <button onClick={onGoForward}>Forward</button>
                    <button onClick={onUseState}>Use this state</button>
                </div>
            )
    }
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