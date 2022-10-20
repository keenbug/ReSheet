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
import { catchAll } from './utils'
import { Environment } from './logic/block'


type ViewState =
    | { mode: 'current' }
    | { mode: 'history', position: number }


interface HistoryEntry {
    readonly time: Date
    readonly blockState: ToplevelBlockState
}

interface ApplicationState {
    readonly blockState: ToplevelBlockState
    readonly history: Array<HistoryEntry>
    readonly viewState: ViewState
}

const openHistory = produce<ApplicationState>(state => {
    if (state.history.length > 0) {
        state.viewState = {
            mode: 'history',
            position: state.history.length - 1,
        }
    }
})

const closeHistory = produce<ApplicationState>(state => {
    state.viewState = { mode: 'current' }
})

const goBackInHistory = produce<ApplicationState>(state => {
    if (state.viewState.mode === 'history') {
        state.viewState.position = Math.max(0, state.viewState.position - 1)
    }
})

const goForwardInHistory = produce<ApplicationState>(state => {
    if (state.viewState.mode === 'history') {
        state.viewState.position = Math.min(state.viewState.position + 1, state.history.length - 1)
    }
})

const viewStateFromHistory = produce<ApplicationState>(state => {
    if (state.viewState.mode === 'history') {
        const historicState = original(state).history[state.viewState.position]
        state.history.push(historicState)
        state.blockState = historicState.blockState
        state.viewState = { mode: 'current' }
    }
})


type ToplevelBlockState = CommandModel
const ToplevelBlock = CommandBlock(library.blocks)


const initApplicationState = (initBlockState: ToplevelBlockState): ApplicationState => {
    return {
        blockState: initBlockState,
        history: [{ time: new Date(), blockState: initBlockState }],
        viewState: { mode: 'current' },
    }
}

const historyToJSON = (history: Array<HistoryEntry>) => {
    return history.map(entry => (
        {
            time: entry.time.getTime(),
            blockState: ToplevelBlock.toJSON(entry.blockState),
        }
    ))
}

const historyFromJSON = (json: { time: number, blockState: any }[], env: Environment) => {
    return json.map(historyEntryJson => (
        {
            time: new Date(historyEntryJson.time),
            blockState: ToplevelBlock.fromJSON(historyEntryJson.blockState, env),
        }
    ))
}


/****************** Main Application ******************/

const loadSavedState = (): ApplicationState => {
    try {
        const savedJson = JSON.parse(localStorage.getItem('block'))
        const blockState = ToplevelBlock.fromJSON(savedJson, library)
        const savedHistory = catchAll(
            () =>
                historyFromJSON(
                    JSON.parse(localStorage.getItem('history')),
                    library,
                ),
            () => {
                localStorage.setItem(
                    `history-backup-${new Date()}`,
                    localStorage.getItem('history'),
                )
                return [{ time: new Date(), blockState }]
            },
        )
        return {
            blockState,
            history: savedHistory,
            viewState: { mode: 'current' },
        }
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

    React.useEffect(() => {
        try {
            const stateAsJson = ToplevelBlock.toJSON(state.blockState)
            localStorage.setItem('block', JSON.stringify(stateAsJson))
            const historyAsJson = historyToJSON(state.history)
            localStorage.setItem('history', JSON.stringify(historyAsJson))
        }
        catch (error) { setSavingError(error) }
    }, [state.blockState])

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

    const onOpenHistory  = () => setState(openHistory)
    const onCloseHistory = () => setState(closeHistory)
    const onGoBack       = () => setState(goBackInHistory)
    const onGoForward    = () => setState(goForwardInHistory)
    const onUseState     = () => setState(viewStateFromHistory)

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
            <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
            History
        </button>
    )
}

const useTrigger = (onTrigger: () => void) => {
    const timeoutRef = React.useRef<null | NodeJS.Timeout>(null)

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [timeoutRef])

    const triggerPeriodically = (period: number) => () => {
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

const MenuBarContainer = classed<any>('div')`bg-gray-100 p-1 flex space-x-2`
const TimeContainer = classed<any>('div')`self-center flex space-x-1 px-2`

const MenuBar = ({ viewState, history, onOpenHistory, onCloseHistory, onGoBack, onGoForward, onUseState }) => {
    const [startGoBack, stopGoBack] = useTrigger(onGoBack)
    const [startGoForward, stopGoForward] = useTrigger(onGoForward)

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
                    <TimeContainer>
                        <button onMouseDown={startGoBack} onMouseUp={stopGoBack} onMouseLeave={stopGoBack}>
                            <FontAwesomeIcon icon={solidIcons.faAngleLeft} />
                        </button>
                        <button onMouseDown={startGoForward} onMouseUp={stopGoForward} onMouseLeave={stopGoBack}>
                            <FontAwesomeIcon icon={solidIcons.faAngleRight} />
                        </button>
                        <div className="self-center px-1">
                            {formatTime(history[viewState.position].time)}
                        </div>
                    </TimeContainer>
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