import * as React from "react"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import * as solidIcons from "@fortawesome/free-solid-svg-icons"

import { Environment } from "../../block"
import { useAutoretrigger } from "../../ui/hooks"


export type HistoryMode =
    | { type: 'current' }
    | { type: 'history', position: number }

export interface HistoryWrapper<State> {
    mode: HistoryMode
    history: Array<HistoryEntry<State>>
    inner: State
}

export interface HistoryWrapperJSON<StateJSON> {
    history: HistoryEntryJSON<StateJSON>[]
    inner: StateJSON
}

export type HistoryEntry<State> =
    | {
        readonly type: 'state'
        readonly time: Date
        readonly state: State
    }
    | {
        readonly type: 'json'
        readonly time: Date
        readonly stateJSON: any
    }

export interface HistoryEntryJSON<StateJSON> {
    time: number
    state: StateJSON
}


export function initHistory<State>(initState: State): HistoryWrapper<State> {
    return {
        mode: { type: 'current' },
        history: [{ type: 'state', time: new Date(), state: initState }],
        inner: initState,
    }
}

export function updateHistoryInner<State>(
    state: HistoryWrapper<State>,
    update: (state: State) => State,
    env: Environment,
    fromJSON: (json: any) => State,
): HistoryWrapper<State> {
    switch (state.mode.type) {
        case 'current': {
            const newInner = update(state.inner)
            return {
                ...state,
                history: reduceHistory([ ...state.history, { type: 'state', time: new Date(), state: newInner }]),
                inner: newInner,
            }
        }

        case 'history': {
            const historicState = state.history[state.mode.position]
            const oldInner = getHistoryState(historicState, env, fromJSON)
            const newInner = update(oldInner)
            return {
                ...state,
                mode: { type: 'current' },
                history: [ ...state.history, { type: 'state', time: new Date(), state: newInner } ],
                inner: newInner,
            }
        }
    }
}


export function openHistory<State>(state: HistoryWrapper<State>): HistoryWrapper<State> {
    if (state.history.length === 0) { return state }

    return {
        ...state,
        mode: {
            type: 'history',
            position: state.history.length - 1,
        },
    }
}

export function closeHistory<State>(state: HistoryWrapper<State>): HistoryWrapper<State> {
    return {
        ...state,
        mode: { type: 'current' },
    }
}

export function goBackInHistory<State>(state: HistoryWrapper<State>): HistoryWrapper<State> {
    if (state.mode.type !== 'history') { return state }

    return {
        ...state,
        mode: {
            ...state.mode,
            position: Math.max(0, state.mode.position - 1),
        }
    }
}

export function goForwardInHistory<State>(state: HistoryWrapper<State>): HistoryWrapper<State> {
    if (state.mode.type !== 'history') { return state }

    return {
        ...state,
        mode: {
            ...state.mode,
            position: Math.min(state.mode.position + 1, state.history.length - 1),
        }
    }
}

export function restoreStateFromHistory<State>(
    state: HistoryWrapper<State>,
    env: Environment,
    fromJSON: (state: State, env: Environment) => State,
): HistoryWrapper<State> {
    if (state.mode.type === 'history') {
        const historicState = state.history[state.mode.position]
        return {
            ...state,
            mode: { type: 'current' },
            history: [ ...state.history, historicState ],
            inner: getHistoryState(historicState, env, fromJSON),
        }
    }
    return state
}



export function getHistoryState<State>(
    entry: HistoryEntry<State>,
    env: Environment,
    fromJSON: (state: any, env: Environment) => State,
) {
    switch (entry.type) {
        case 'state':
            return entry.state
        case 'json':
            return fromJSON(entry.stateJSON, env)
    }
}

export function historyToJSON<State>(
    historyWrapper: HistoryWrapper<State>,
    toJSON: (state: State) => unknown,
): HistoryWrapperJSON<unknown> {
    return {
        history: historyWrapper.history.map(entry => {
            switch (entry.type) {
                case 'json':
                    return {
                        time: entry.time.getTime(),
                        state: entry.stateJSON,
                    }
                case 'state':
                    return {
                        time: entry.time.getTime(),
                        state: toJSON(entry.state),
                    }
            }
        }),
        inner: toJSON(historyWrapper.inner),
    }
}

export function historyFromJSON<State>(
    json: HistoryWrapperJSON<unknown>,
    env: Environment,
    fromJSON: (json: any, env: Environment) => State,
): HistoryWrapper<State> {
    return {
        mode: { type: 'current' },
        history: json.history.map(historyEntryJson => (
            {
                type: 'json',
                time: new Date(historyEntryJson.time),
                stateJSON: historyEntryJson.state,
            }
        )),
        inner: fromJSON(json.inner, env),
    }
}

export function reduceHistory<State>(history: Array<HistoryEntry<State>>): Array<HistoryEntry<State>> {
    return history.filter((entry, index) => {
        const nextTime = history[index + 1]?.time?.getTime() ?? Number.POSITIVE_INFINITY
        const differenceMS = nextTime - entry.time.getTime()
        const reverseIndex = history.length - index
        return differenceMS / 100 > reverseIndex ** 2
    })
}





export interface HistoryViewProps<Inner> {
    state: HistoryWrapper<Inner>
    children: (state: Inner) => JSX.Element
    env: Environment
    fromJSON: (json: any, env: Environment) => Inner
}

export function HistoryView<Inner>({ state, children: viewInner, env, fromJSON }: HistoryViewProps<Inner>) {
    switch (state.mode.type) {
        case 'current':
            return viewInner(state.inner)
        
        case 'history':
            const entryInHistory = state.history[state.mode.position]
            if (entryInHistory === undefined) { return null }

            const stateInHistory = getHistoryState(entryInHistory, env, fromJSON)
            return viewInner(stateInHistory)
    }
}



export interface HistoryActions {
    goBack(): void
    goForward(): void
    restoreStateFromHistory(): void
}

export interface HistoryModePanelProps<Inner> {
    state: HistoryWrapper<Inner>
    actions: HistoryActions
}


export function HistoryModePanel<Inner>({ state, actions }: HistoryModePanelProps<Inner>) {
    const [startGoBack, stopGoBack] = useAutoretrigger(actions.goBack)
    const [startGoForward, stopGoForward] = useAutoretrigger(actions.goForward)

    if (state.mode.type !== 'history') {
        return null
    }

    return (
        <div
            className={`
                sticky top-0 left-0 right-0 z-10
                bg-blue-100 text-blue-950 backdrop-opacity-90 backdrop-blur
                shadow mb-2 flex space-x-2 items-baseline
            `}
        >
            <button className="px-2 rounded hover:bg-blue-500 hover:text-blue-50" onClick={actions.restoreStateFromHistory}>
                Restore
            </button>

            <div className="flex-1 flex space-x-1 px-2">
                <button className="px-2 hover:text-blue-500" onMouseDown={startGoBack} onMouseUp={stopGoBack} onMouseLeave={stopGoBack}>
                    <FontAwesomeIcon icon={solidIcons.faAngleLeft} />
                </button>
                <button className="px-2 hover:text-blue-500" onMouseDown={startGoForward} onMouseUp={stopGoForward} onMouseLeave={stopGoBack}>
                    <FontAwesomeIcon icon={solidIcons.faAngleRight} />
                </button>
                <div className="self-center px-1">
                    {formatTime(state.history[state.mode.position].time)}
                </div>
            </div>
        </div>
    )
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