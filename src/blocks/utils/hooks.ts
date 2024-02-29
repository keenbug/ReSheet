import * as React from 'react'
import { Environment } from '@tables/core'
import { Effectful, useEffectfulUpdate } from '@tables/util/hooks'

// Effectful action with Env
export type EAction<State> = (state: State, env: Environment) => Effectful<State>

// Effectful updater with Env
export type EUpdater<State> = (action: EAction<State>) => void

export function useEUpdate<State>(
    update: (action: (state: State) => State) => void,
    env: Environment,
) {
    const updateFX = useEffectfulUpdate(update)
    return React.useCallback(function eupdate(eaction: EAction<State>) {
        updateFX(state => eaction(state, env))
    }, [updateFX, env])
}
