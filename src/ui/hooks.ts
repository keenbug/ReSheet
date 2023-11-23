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
    const effectQueue = React.useRef([])

    React.useEffect(() => {
        if (effectQueue.current.length > 0) {
            effectQueue.current.forEach(effect => {
                effect()
            })
            effectQueue.current.splice(0, effectQueue.current.length)
        }
    })

    function queue(...effects) {
        effectQueue.current.push(...effects)
    }

    return queue
}

export type EffectfulAction<State> = (state: State) => [State, ...Array<() => void>]
export type EffectfulUpdater<State> = (action: EffectfulAction<State>) => void

export function useEffectfulUpdate<State>(
    update: (action: (state: State) => State) => void
): EffectfulUpdater<State> {
    const queueEffects = useEffectQueue()

    return (effectfulAction: EffectfulAction<State>) => {
        update(state => {
            const [newState, ...effects] = effectfulAction(state)
            queueEffects(...effects)
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