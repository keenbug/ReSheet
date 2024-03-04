import * as React from 'react'
import { BlockDispatcher, Environment } from '@tables/core/block'
import { EffectfulAction, EffectfulDispatcher, useEffectfulDispatch } from '@tables/util/hooks'

// Effectful action with Env
export type EnvAction<State> = EffectfulAction<State, [Environment]>

// Effectful dispatcher with Env
export type EnvDispatcher<State> = EffectfulDispatcher<State, [Environment]>

export function useEnvDispatcher<State>(
    dispatch: BlockDispatcher<State>,
    env: Environment,
) {
    const dispatchFX = useEffectfulDispatch(dispatch)
    return React.useCallback(
        function envDispatch(envAction: EnvAction<State>) {
            dispatchFX(state => envAction(state, env))
        },
        [dispatchFX, env],
    )
}
