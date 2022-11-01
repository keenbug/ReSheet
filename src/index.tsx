import * as React from 'react'
import ReactDOM from 'react-dom'

import 'prismjs/themes/prism.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import { CommandBlock, CommandModel } from './blocks/command'
import { ErrorBoundary, ErrorInspector } from './ui/value'
import { library } from './utils/std-library'
import { classed, ErrorView } from './ui/utils'
import { catchAll } from './utils'
import { Environment } from './logic/block'
import { useThrottle } from './ui/hooks'
import { SheetBlock } from './blocks/sheet'
import { JSExprBlock } from './blocks/jsexpr'


type ViewState =
    | { mode: 'current' }
    | { mode: 'history', position: number }


type HistoryEntry =
    | {
        readonly type: 'state'
        readonly time: Date
        readonly blockState: ToplevelBlockState
    }
    | {
        readonly type: 'json'
        readonly time: Date
        readonly blockJSON: any
    }

interface ApplicationState {
    readonly blockState: ToplevelBlockState
    readonly history: Array<HistoryEntry>
    readonly viewState: ViewState
}

function openHistory(state: ApplicationState): ApplicationState {
    if (state.history.length > 0) {
        return {
            ...state,
            viewState: {
                mode: 'history',
                position: state.history.length - 1,
            },
        }
    }
    return state
}

function closeHistory(state: ApplicationState): ApplicationState {
    return {
        ...state,
        viewState: { mode: 'current' },
    }
}

function goBackInHistory(state: ApplicationState): ApplicationState {
    if (state.viewState.mode === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                position: Math.max(0, state.viewState.position - 1),
            }
        }
    }
    return state
}

function goForwardInHistory(state: ApplicationState): ApplicationState {
    if (state.viewState.mode === 'history') {
        return {
            ...state,
            viewState: {
                ...state.viewState,
                position: Math.min(state.viewState.position + 1, state.history.length - 1),
            }
        }
    }
    return state
}

function viewStateFromHistory(state: ApplicationState, env: Environment): ApplicationState {
    if (state.viewState.mode === 'history') {
        const historicState = state.history[state.viewState.position]
        return {
            ...state,
            history: [ ...state.history, historicState ],
            blockState: getHistoryState(historicState, env),
            viewState: { mode: 'current' },
        }
    }
    return state
}

const blocks = library.blocks

type ToplevelBlockState = CommandModel
const ToplevelBlock = CommandBlock('', null, blocks.StateEditor(blocks), blocks)


const initApplicationState = (initBlockState: ToplevelBlockState): ApplicationState => {
    return {
        blockState: initBlockState,
        history: [{ type: 'state', time: new Date(), blockState: initBlockState }],
        viewState: { mode: 'current' },
    }
}


function getHistoryState(entry: HistoryEntry, env: Environment) {
    switch (entry.type) {
        case 'state':
            return entry.blockState
        case 'json':
            return ToplevelBlock.fromJSON(entry.blockJSON, env)
    }
}

function historyToJSON(history: Array<HistoryEntry>) {
    return history.map(entry => {
        switch (entry.type) {
            case 'json':
                return {
                    time: entry.time.getTime(),
                    state: entry.blockJSON,
                }
            case 'state':
                return {
                    time: entry.time.getTime(),
                    state: ToplevelBlock.toJSON(entry.blockState),
                }
        }
    })
}

function historyFromJSON(
    json: { time: number, state: any }[],
): HistoryEntry[] {
    return json.map(historyEntryJson => (
        {
            type: 'json',
            time: new Date(historyEntryJson.time),
            blockJSON: historyEntryJson.state,
        }
    ))
}

const reduceHistory = (history: Array<HistoryEntry>): Array<HistoryEntry> => {
    return history.slice(1)
}


/****************** Main Application ******************/

const loadSavedState = (): ApplicationState => {
    const blockState = catchAll(
        () => {
            const savedJson = JSON.parse(localStorage.getItem('block'))
            return ToplevelBlock.fromJSON(savedJson, library)
        },
        (e) => {
            console.warn("Could not load saved state:", e)
            return ToplevelBlock.init
        }
    )
    const savedHistory = catchAll(
        () => {
            const historyJSON = localStorage.getItem('history')
            localStorage.setItem('history-backup', historyJSON)
            return historyFromJSON(
                JSON.parse(historyJSON),
            )
        },
        (e) => {
            console.warn("Could not load saved history:", e)
            localStorage.setItem(
                `history-backup-${Date.now()}`,
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

const saveHistory = (history: Array<HistoryEntry>) => {
    try {
        const historyAsJson = historyToJSON(history)
        localStorage.setItem('history', JSON.stringify(historyAsJson))
    }
    catch (e) {
        if (history.length > 1) {
            saveHistory(reduceHistory(history))
        }
        else {
            throw e
        }
    }
}

const App = () => {
    const [state, setState] = React.useState<ApplicationState>(loadSavedState)
    const [updateError, setUpdateError] = React.useState<null | Error>(null)
    const [savingError, setSavingError] = React.useState<null | Error>(null)

    const persistStateAndHistory = useThrottle(5000, (state: ApplicationState) => {
        try {
            const stateAsJson = ToplevelBlock.toJSON(state.blockState)
            localStorage.setItem('block', JSON.stringify(stateAsJson))
            saveHistory(state.history)
        }
        catch (error) { setSavingError(error) }
    })

    React.useEffect(() => {
        persistStateAndHistory(state)
    }, [state.blockState])

    const safeUpdate = action => {
        setState(state => {
            try {
                const newBlockState = action(state.blockState)
                return {
                    ...state,
                    blockState: newBlockState,
                    history: [
                        ...state.history,
                        { type: 'state', time: new Date(), blockState: newBlockState },
                    ],
                }
            }
            catch (error) {
                setUpdateError(error)
                return state
            }
        })
    }

    const env = { ...library, history: state.history }

    const viewToplevelBlock = () => {
        switch (state.viewState.mode) {
            case 'current':
                return ToplevelBlock.view({
                    state: state.blockState,
                    update: safeUpdate,
                    env,
                })
            
            case 'history':
                const entryInHistory = state.history[state.viewState.position]
                if (entryInHistory === undefined) { return null }

                const stateInHistory = getHistoryState(entryInHistory, env)
                return ToplevelBlock.view({
                    state: stateInHistory,
                    update: () => {},
                    env,
                })
        }
    }

    const onOpenHistory  = () => setState(openHistory)
    const onCloseHistory = () => setState(closeHistory)
    const onGoBack       = () => setState(goBackInHistory)
    const onGoForward    = () => setState(goForwardInHistory)
    const onUseState     = () => setState(state => viewStateFromHistory(state, env))

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
                <div className="px-2">
                    {viewToplevelBlock()}
                </div>
            </ErrorBoundary>
        </React.Fragment>
    )
}


const HistoryButton = ({ isActive, ...props }) => {
    const className = `
        px-2
        py-0.5
        rounded
        ${isActive ?
            'text-blue-50 bg-blue-700 hover:bg-blue-500'
        :
            'hover:text-blue-900 hover:bg-blue-200'
        }
    `
    return (
        <button className={className} {...props}>
            <FontAwesomeIcon className="mr-1" size="xs" icon={solidIcons.faClockRotateLeft} />
            History
        </button>
    )
}

const useTrigger = (onTrigger: () => void) => {
    const timeoutRef = React.useRef<null | number>(null)

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

const MenuBarContainer = classed<any>('div')`
    sticky top-0 z-10
    bg-white
    shadow p-1 mb-2 flex space-x-2
`
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