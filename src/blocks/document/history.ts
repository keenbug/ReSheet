import { Environment } from "../../block"

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