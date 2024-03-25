import * as React from "react"

import { BlockAction, BlockDispatcher, Environment, extractActionDescription } from "@resheet/core/block"
import { clampTo } from "@resheet/util"

import { getFullKey } from "../utils/ui"


export type HistoryMode =
    | { type: 'current' }
    | { type: 'history', position: number }

export interface HistoryWrapper<State> {
    mode: HistoryMode
    history: Array<HistoryEntry<State>>
    inner: State
}

export type HistoryEntry<State> = {
    time: Date
    state: State
    prev?: Date
}

export interface HistoryWrapperJSON<StateJSON> {
    history: unknown[] // for backwards compatibility
    inner: StateJSON
}


export function initHistory<State>(initState: State): HistoryWrapper<State> {
    return {
        mode: { type: 'current' },
        history: [{ time: new Date(), state: initState }],
        inner: initState,
    }
}

export function innerDispatcher<State>(
    dispatch: BlockDispatcher<HistoryWrapper<State>>,
    env: Environment,
    fromJSON: (json: any, env: Environment) => State,
): BlockDispatcher<State> {
    return function dispatchInner(action: BlockAction<State>) {
        dispatch(state => extractActionDescription(action, pureAction =>
            updateHistoryCurrent(
                state,
                pureAction,
                env,
                fromJSON,
            )
        ))
    }
}

export function updateHistoryCurrent<State>(
    state: HistoryWrapper<State>,
    action: (state: State) => State,
    env: Environment,
    fromJSON: (state: any, env: Environment) => State,
): HistoryWrapper<State> {
    switch (state.mode.type) {
        case 'current': {
            const newInner = action(state.inner)
            return {
                ...state,
                history: reduceHistory([ ...state.history, { time: new Date(), state: newInner, prev: state.history[0]?.time }]),
                inner: newInner,
            }
        }

        case 'history': {
            const entryInHistory = state.history[state.mode.position]
            if (entryInHistory === undefined) { return state }

            const stateInHistory = getHistoryState(entryInHistory, env, fromJSON)
            const newInner = action(stateInHistory)
            return {
                mode: { type: 'current' },
                history: reduceHistory([ ...state.history, { time: new Date(), state: newInner, prev: entryInHistory.time }]),
                inner: newInner,
            }
        }
    }
}

export function getCurrentState<State>(
    state: HistoryWrapper<State>,
    env: Environment,
    fromJSON: (json: any, env: Environment) => State,
): State {
    switch (state.mode.type) {
        case 'current':
            return state.inner

        case 'history': {
            const entryInHistory = state.history[state.mode.position]
            if (entryInHistory === undefined) { return state.inner }

            const stateInHistory = getHistoryState(entryInHistory, env, fromJSON)
            return stateInHistory
        }
    }
}


export function openHistory<State>(state: HistoryWrapper<State>): HistoryWrapper<State> {
    if (state.history.length <= 1) { return state }

    return {
        ...state,
        mode: {
            type: 'history',
            position: state.history.length - 2,
        },
    }
}

export function closeHistory<State>(state: HistoryWrapper<State>): HistoryWrapper<State> {
    return {
        ...state,
        mode: { type: 'current' },
    }
}

export function moveInHistory<State>(steps: number, state: HistoryWrapper<State>): HistoryWrapper<State> {
    if (state.mode.type !== 'history') { return state }

    return {
        ...state,
        mode: {
            ...state.mode,
            position: clampTo(0, state.history.length, state.mode.position + steps),
        }
    }
}

export function restoreStateFromHistory<State>(
    state: HistoryWrapper<State>,
    env: Environment,
    fromJSON: (state: State, env: Environment) => State,
): HistoryWrapper<State> {
    if (state.mode.type === 'current') {
        return state
    }

    const historicState = {
        ...state.history[state.mode.position],
        time: new Date(),
    }
    return {
        ...state,
        mode: { type: 'current' },
        history: [ ...state.history, historicState ],
        inner: getHistoryState(historicState, env, fromJSON),
    }
}



export function getHistoryState<State>(
    entry: HistoryEntry<State>,
    env: Environment,
    fromJSON: (state: any, env: Environment) => State,
) {
    return entry.state
}

export function historyToJSON<State>(
    historyWrapper: HistoryWrapper<State>,
    toJSON: (state: State) => unknown,
): HistoryWrapperJSON<unknown> {
    return {
        history: [],
        inner: toJSON(historyWrapper.inner),
    }
}

export function historyFromJSON<State>(
    json: HistoryWrapperJSON<unknown>,
    env: Environment,
    fromJSON: (json: any, env: Environment) => State,
): HistoryWrapper<State> {
    return initHistory(fromJSON(json.inner, env))
}


export function reduceHistory<State>(history: Array<HistoryEntry<State>>): Array<HistoryEntry<State>> {
    const now = Date.now()
    let entries = [...history].reverse()
    let currentEntry = entries.splice(0, 1)[0]

    const reducedEntries = [currentEntry]

    while (entries.length > 0) {
        const optimalNextEntryTime = currentEntry.time.getTime() - ((now - currentEntry.time.getTime()) / 12)

        const lastEntryBeforeOptimalTime = entries.filter(entry => entry.time.getTime() > optimalNextEntryTime).slice(-1)[0]
        const lastEntryBeforeTimeDiff = (
            lastEntryBeforeOptimalTime === undefined ?
                Number.POSITIVE_INFINITY
            : (
                lastEntryBeforeOptimalTime.time.getTime() - optimalNextEntryTime
            )
        )

        const firstEntryAfterOptimalTime = (
            entries.find(entry => entry.time.getTime() < optimalNextEntryTime)
            ?? entries.slice(-1)[0] // fall back to just keeping the last (oldest/first) history entry
        )
        const firstEntryAfterTimeDiff = optimalNextEntryTime - firstEntryAfterOptimalTime.time.getTime()

        const nextEntry = (
            lastEntryBeforeTimeDiff < firstEntryAfterTimeDiff ?
                lastEntryBeforeOptimalTime
            :
                firstEntryAfterOptimalTime
        )

        const nextEntryIndex = entries.findIndex(entry => entry.time.getTime() === nextEntry.time.getTime())

        currentEntry = nextEntry
        entries.splice(0, nextEntryIndex + 1)
        reducedEntries.push(nextEntry)
    }

    return reducedEntries.reverse()
}




export interface HistoryViewProps<Inner> {
    state: HistoryWrapper<Inner>
    dispatch: BlockDispatcher<HistoryWrapper<Inner>>
    children: (props: { state: Inner, dispatch: BlockDispatcher<Inner>, dispatchHistory: BlockDispatcher<HistoryWrapper<Inner>> }) => React.ReactNode
    env: Environment
    fromJSON: (json: any, env: Environment) => Inner
}

export function HistoryView<Inner>({ state, dispatch, children: viewInner, env, fromJSON }: HistoryViewProps<Inner>) {
    // capture undo/redo, so no other component starts its own undo/redo logic
    function onKeyDownHistory(event: React.KeyboardEvent) {
        switch (getFullKey(event)) {
            case "C-Z":
                dispatch(state => ({ state: moveInHistory(-1, state), description: "undo" }))
                event.stopPropagation()
                event.preventDefault()
                return

            case "C-Shift-Z":
            case "C-Y":
                dispatch(state => ({ state: moveInHistory(1, state), description: "redo" }))
                event.stopPropagation()
                event.preventDefault()
                return
        }
    }

    function onKeyDownCurrent(event: React.KeyboardEvent) {
        switch (getFullKey(event)) {
            case "C-Z":
                dispatch(state => ({ state: openHistory(state), description: "undo" }))
                event.stopPropagation()
                event.preventDefault()
                return
        }
    }

    const dispatchInner = React.useMemo(
        () => innerDispatcher(dispatch, env, fromJSON),
        [env, fromJSON],
    )

    switch (state.mode.type) {
        case 'current':
            return (
                <div className="h-full w-full" onKeyDownCapture={onKeyDownCurrent}>
                    {viewInner({ state: state.inner, dispatch: dispatchInner, dispatchHistory: dispatch })}
                </div>
            )
        
        case 'history':
            const entryInHistory = state.history[state.mode.position]
            if (entryInHistory === undefined) { return null }

            const stateInHistory = getHistoryState(entryInHistory, env, fromJSON)
            return (
                <div className="h-full w-full" onKeyDownCapture={onKeyDownHistory}>
                    {viewInner({ state: stateInHistory, dispatch: dispatchInner, dispatchHistory: dispatch })}
                </div>
            )
    }
}
