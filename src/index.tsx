import * as React from 'react'
import ReactDOM from 'react-dom'
import produce, { original } from 'immer'

import 'prismjs/themes/prism.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { CommandBlock, CommandModel } from './blocks/command'
import { ErrorBoundary, ErrorInspector } from './ui/value'
import { library } from './utils/std-library'
import { classed, ErrorView } from './ui/utils'


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

    const onCloseHistory = () => {
        setState(produce(state => {
            state.viewState = { mode: 'current' }
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
                state.viewState.position = Math.min(state.viewState.position + 1, state.history.length - 1)
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
                onCloseHistory={onCloseHistory}
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


const HistoryButton = ({ isActive, ...props }) => {
    const className = `
        px-2
        py-0.5
        rounded
        ${isActive ? 'bg-gray-200' : ''}
        hover:bg-gray-300
    `
    return (
        <button className={className} {...props}>
            <FontAwesomeIcon size="xs" icon={solidIcons.faClockRotateLeft} />
            History
        </button>
    )
}

const useTrigger = (onTrigger) => {
    const timeoutRef = React.useRef<null | NodeJS.Timeout>(null)

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [timeoutRef])

    const triggerPeriodically = period => () => {
        onTrigger()
        timeoutRef.current = setTimeout(triggerPeriodically(period * 0.99), period)
    }

    const triggerStart = () => {
        onTrigger()
        timeoutRef.current = setTimeout(triggerPeriodically(100), 1000)
    }

    const triggerStop = () => {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current)
        }
    }

    return [triggerStart, triggerStop]
}

const MenuBarContainer = classed<any>('div')`bg-gray-100 p-1 flex space-x-1`

const MenuBar = ({ viewState, history, onOpenHistory, onCloseHistory, onGoBack, onGoForward, onUseState }) => {
    const [startGoBack, stopGoBack] = useTrigger(onGoBack)
    const [startGoForward, stopGoForward] = useTrigger(onGoForward)

    // TODO styling
    switch (viewState.mode) {
        case 'current':
            return (
                <MenuBarContainer>
                    <HistoryButton isActive={false} onClick={onOpenHistory} />
                </MenuBarContainer>
            )
        case 'history':
        default:
            return (
                <MenuBarContainer>
                    <HistoryButton isActive={true} onClick={onCloseHistory} />
                    <button onMouseDown={startGoBack} onMouseUp={stopGoBack}>
                        <FontAwesomeIcon icon={solidIcons.faAngleLeft} />
                    </button>
                    <button onMouseDown={startGoForward} onMouseUp={stopGoForward}>
                        <FontAwesomeIcon icon={solidIcons.faAngleRight} />
                    </button>
                    <div>{formatTime(history[viewState.position].time)}</div>
                    <button style={{ marginLeft: 'auto' }} onClick={onUseState}>
                        Use this state
                    </button>
                </MenuBarContainer>
            )
    }
}


const secondInMs = 1000
const minuteInMs = 60 * secondInMs
const hourInMs = 60 * minuteInMs
const dayInMs = 24 * hourInMs

const formatTime = (date: Date) => {
    const diffInMs = Date.now() - date.getTime()
    if (diffInMs < dayInMs) {
        return Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date)
    }
    else {
        const formatOptions: Intl.DateTimeFormatOptions = {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }
        return Intl.DateTimeFormat(undefined, formatOptions).format(date)
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