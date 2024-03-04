import React from 'react'

export type Action<State, Input extends any[] = [], Output extends object = {}> =
    (state: State, ...args: Input) => { state: State } & Output

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


export function updateToDispatch<State>(update: React.Dispatch<(state: State) => State>): Dispatcher<State> {
    return function dispatch(action) {
        update(state => action(state).state)
    }
}

export function useDispatcher<State>(init: State): [State, Dispatcher<State>] {
    const [state, setState] = React.useState(init)
    const dispatch = React.useMemo(() => updateToDispatch(setState), [setState])
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
                ...output as Output,
            }
        })
    }
}

export function fieldDispatcher<State extends object, Field extends keyof State>(
    fieldName: Field,
    dispatch: Dispatcher<State>,
): Dispatcher<State[Field]> {
    return mapDispatcher(
        state => state[fieldName],
        (newState, oldState) => ({ ...oldState, [fieldName]: newState }),
        dispatch,
    )
}
