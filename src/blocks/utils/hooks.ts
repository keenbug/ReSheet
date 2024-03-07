import * as React from 'react'
import { Environment } from '@tables/core/block'
import { EffectfulAction, EffectfulDispatcher, useEffectfulDispatch } from '@tables/util/hooks'
import { Dispatcher } from '@tables/util/dispatch'

// Effectful action with Env
export type EnvAction<State, Input extends any[] = [], Output extends object = {}> = EffectfulAction<State, [Environment, ...Input], Output>

// Effectful dispatcher with Env
export type EnvDispatcher<State, Input extends any[] = [], Output extends object = {}> = EffectfulDispatcher<State, [Environment, ...Input], Output>

export function useEnvDispatcher<State, Input extends any[] = [], Output extends object = {}>(
    dispatch: Dispatcher<State, Input, Output>,
    env: Environment,
) {
    const dispatchFX = useEffectfulDispatch(dispatch)
    return React.useCallback(
        function envDispatch(envAction: EnvAction<State, Input, Output>) {
            dispatchFX((state, ...input) => envAction(state, env, ...input))
        },
        [dispatchFX, env],
    )
}
