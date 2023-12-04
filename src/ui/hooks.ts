import * as React from 'react'
import { throttle } from 'throttle-debounce'

export interface ThrottleOptions {
    noTrailing?: boolean;
    noLeading?: boolean;
    debounceMode?: boolean;
}

export function useThrottle<Callback extends (...args: unknown[]) => unknown>(
    delay: number,
    callback: Callback,
    options?: ThrottleOptions,
): throttle<Callback> {
    const [throttledFunc] = React.useState(() => throttle(delay, callback, options))
    return throttledFunc
}

export function useAutoretrigger<Args extends Array<any> = []>(
    onTrigger: (...args: Args) => void
): [
    (...args: Args) => void,
    () => void,
] {
    const timeoutRef = React.useRef<null | number>(null)

    function triggerPeriodically(period: number, args: Args) {
        return () => {
            onTrigger(...args)
            timeoutRef.current = setTimeout(triggerPeriodically(period * 0.99, args), period)
        }
    }

    function triggerStart(...args: Args) {
        onTrigger(...args)
        timeoutRef.current = setTimeout(triggerPeriodically(100, args), 1000)
    }

    function triggerStop() {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current)
        }
    }

    return [triggerStart, triggerStop]
}


export function useEffectQueue() {
    const effect = React.useRef<() => void>()

    React.useEffect(() => {
        if (typeof effect.current === 'function') {
            effect.current()
            effect.current = undefined
        }
    })

    function queueEffect(newEffect: () => void) {
        if (typeof effect.current !== 'function') {
            effect.current = newEffect
        }
        else {
            const previousEffect = effect.current
            effect.current = () => {
                previousEffect()
                newEffect()
            }
        }
    }

    return queueEffect
}

export function manyEffects(...effects: Array<() => void>): () => void {
    return () => {
        effects.forEach(effect => {
            effect()
        })
    }
}

export interface Effectful<State> {
    state?: State
    effect?: () => void
}
export type EffectfulAction<State> = (state: State) => Effectful<State>
export type EffectfulUpdater<State> = (action: EffectfulAction<State>) => void

export function useEffectfulUpdate<State>(
    update: (action: (state: State) => State) => void
): EffectfulUpdater<State> {
    const queueEffect = useEffectQueue()

    return (effectfulAction: EffectfulAction<State>) => {
        update(state => {
            const {
                state: newState = state,
                effect,
            } = effectfulAction(state)

            if (effect !== undefined) {
                queueEffect(effect)
            }

            return newState
        })
    }
}

export function useRefMap<Key, Ref>(
): [
    (key: Key) => (ref: Ref) => void,
    Map<Key, Ref>
] {
    const refMap = React.useRef(new Map<Key, Ref>())
    const setRef = (key: Key) => (ref: Ref | null) => {
        if (ref === null) {
            refMap.current.delete(key)
        }
        else {
            refMap.current.set(key, ref)
        }
    }
    return [setRef, refMap.current]
}