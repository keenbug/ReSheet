import React from 'react'
import { set } from 'immutable'

export type Action<State, Input extends any[] = [], Output extends object = {}> =
    (state: State, ...args: Input) => { state: State } & Omit<Output, 'state'>

export type Dispatcher<State, Input extends any[] = [], Output extends object = {}> =
    React.Dispatch<Action<State, Input, Output>>


export function debugDispatcher<State, Input extends any[] = [], Output extends object = {}>(
    dispatch: Dispatcher<State, Input, Output>,
): Dispatcher<State, Input, Output> {
    return function dispatchDebug(action) {
        return dispatch((state, ...input) => {
            debugger
            const result = action(state, ...input)
            return result
        })
    }
}

export function logDispatcher<State, Input extends any[] = [], Output extends object = {}>(
    dispatch: Dispatcher<State, Input, Output>,
): Dispatcher<State, Input, Output> {
    return function dispatchLog(action) {
        return dispatch((state, ...input) => {
            console.log('dispatch incoming', { state, input })
            const result = action(state, ...input)
            console.log('dispatch outgoing', result)
            return result
        })
    }
}


export function updateToDispatch<State, Input extends any[] = [], Output extends object = {}>(
    update: React.Dispatch<(state: State) => State>,
    input: Input,
    handleOutput: (output: Omit<Output, 'state'>, oldState: State, newState: State) => void,
): Dispatcher<State, Input, Output> {
    return function dispatch(action) {
        update(state => {
            const { state: newState, ...output } = action(state, ...input)
            handleOutput(output as Omit<Output, 'state'>, state, newState)
            return newState
        })
    }
}

export function useDispatcher<State, Input extends any[] = [], Output extends object = {}>(
    init: State,
    input: Input,
    handleOutput: (output: Omit<Output, 'state'>, oldState: State, newState: State) => void,
): [State, Dispatcher<State, Input, Output>] {
    const [state, setState] = React.useState(init)
    const dispatch = React.useMemo(
        () => updateToDispatch(setState, input, handleOutput),
        [setState, input, handleOutput],
    )
    return [state, dispatch]
}



export function mapDispatcher<StateBefore, StateAfter, Input extends any[] = [], Output extends object = {}>(
    mapIncoming: (oldState: StateBefore) => StateAfter,
    mapOutgoing: (newState: StateAfter, oldState: StateBefore) => StateBefore,
    dispatch: Dispatcher<StateBefore, Input, Output>,
): Dispatcher<StateAfter, Input, Output> {
    return function mappedDispatch(action) {
        dispatch((stateBefore, ...input) => {
            const { state, ...output } = action(mapIncoming(stateBefore), ...input)
            return {
                state: mapOutgoing(state, stateBefore),
                ...output as Omit<Output, 'state'>,
            }
        })
    }
}

export function fieldDispatcher<
    State extends object,
    Field extends keyof State,
    Input extends any[] = [],
    Output extends object = {},
>(
    fieldName: Field,
    dispatch: Dispatcher<State, Input, Output>,
): Dispatcher<State[Field], Input, Output> {
    return mapDispatcher(
        state => state[fieldName],
        (newFieldState, state) => set(state, fieldName, newFieldState),
        dispatch,
    )
}
