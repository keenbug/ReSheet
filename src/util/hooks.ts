import * as React from 'react'
import { throttle } from 'throttle-debounce'
import _ from 'lodash'

import { isPromise } from '.'
import { Action, Dispatcher } from './dispatch'

export interface ThrottleOptions {
    noTrailing?: boolean
    noLeading?: boolean
    debounceMode?: boolean
}

export type PendingState = 
    | { state: 'finished' }
    | { state: 'pending' }
    | { state: 'failed', error: any }

export function useThrottlePending<Args extends unknown[], Callback extends (...args: Args) => any>(
    delay: number,
    callback: Callback,
    options?: ThrottleOptions,
): [PendingState, (...args: Args) => void] {
    const [pendingState, setPendingState] = React.useState<PendingState>({ state: 'finished' })

    const callbackAndUpdate = React.useCallback((...args: Args) => {
        try {
            const result = callback(...args)
            if (isPromise(result)) {
                result.then(
                    () => { setPendingState({ state: 'finished' }) },
                    (error: any) => { setPendingState({ state: 'failed', error }) },
                )
            }
            else {
                setPendingState({ state: 'finished' })
            }
        }
        catch (error) {
            setPendingState({ state: 'failed', error })
        }
    }, [callback])

    const throttledCallback = React.useMemo(() => throttle(delay, callbackAndUpdate, options), [callbackAndUpdate])

    const callbackWithPending = React.useCallback((...args: Args) => {
        setPendingState({ state: 'pending' })
        throttledCallback(...args)
    }, [throttledCallback])

    return [pendingState, callbackWithPending]
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

    const queueEffect = React.useCallback(function queueEffect(newEffect: () => void) {
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
    }, [effect])

    return queueEffect
}

export function manyEffects(...effects: Array<() => void>): () => void {
    return () => {
        effects.forEach(effect => {
            effect()
        })
    }
}

export type EffectfulOutput = {
    effect?(): void
}

export type EffectfulAction<State, Input extends any[] = [], Output extends object = {}> =
    Action<State, Input, EffectfulOutput & Omit<Output, 'state' | 'effect'>>

export type EffectfulDispatcher<State, Input extends any[] = [], Output extends object = {}> =
    Dispatcher<State, Input, EffectfulOutput & Omit<Output, 'state' | 'effect'>>


export function useEffectfulDispatch<State, Input extends any[] = [], Output extends object = {}>(
    dispatch: Dispatcher<State, Input, Omit<Output, 'effect'>>
): EffectfulDispatcher<State, Input, Omit<Output, 'effect'>> {
    const queueEffect = useEffectQueue()

    return React.useCallback((action: EffectfulAction<State, Input, Output>) => {
        dispatch((state, ...args) => {
            const {
                state: newState = state,
                effect,
                ...output
            } = action(state, ...args)

            if (effect !== undefined) {
                queueEffect(effect)
            }

            return {
                state: newState,
                ...output as Omit<Output, 'effect'>,
            }
        })
    }, [dispatch, queueEffect])
}



export function useRefMap<Key, Ref>(
): [
    (key: Key) => (ref: Ref) => void,
    Map<Key, Ref>
] {
    const refMap = React.useRef(new Map<Key, Ref>())
    const setRef = React.useCallback((key: Key) => (ref: Ref | null) => {
        if (ref === null) {
            refMap.current.delete(key)
        }
        else {
            refMap.current.set(key, ref)
        }
    }, [refMap])
    return [setRef, refMap.current]
}


export function useSyncRef<T>(value: T) {
    const ref = React.useRef(value)
    React.useEffect(() => {
        ref.current = value
    })
    return ref
}


export type WithSkipRender<Component extends React.JSXElementConstructor<any>> =
    React.FC<React.ComponentProps<Component> & { skipRender?: boolean }>

export function renderConditionally<Props>(Component: React.FC<Props>, compareProps: 'never' | 'default' | ((propsBefore: Object, propsAfter: Object) => boolean) = 'default') {
    let compare: (before: Props & { skipRender?: boolean }, after: Props & { skipRender?: boolean }) => boolean
    switch (compareProps) {
        case 'never':
            compare = function neverCompare(_before: Props & { skipRender?: boolean }, after: Props & { skipRender?: boolean }): boolean {
                if (after.skipRender) { return true }
                return false
            }
            break

        case 'default':
            compare = function defaultCompare(before: Props & { skipRender?: boolean }, after: Props & { skipRender?: boolean }): boolean {
                if (after.skipRender) { return true }
                for (const prop in after) {
                    if (prop !== 'skipRender' && !Object.is(before[prop], after[prop])) {
                        return false
                    }
                }
                return true
            }
            break

        default:
            compare = function customCompare(before: Props & { skipRender?: boolean }, after: Props & { skipRender?: boolean }): boolean {
                if (after.skipRender) { return true }
                return compareProps(before, after)
            }
    }
    return React.memo(Component, compare)
}


export function useSelectionRect(active: boolean = true) {
    const [rect, setRect] = React.useState<DOMRect | null>(null)
    const rectRef = useSyncRef(rect)

    function updateSelectionRect() {
        const selection = document.getSelection()
        if (!selection || selection.rangeCount <= 0) {
            if (rectRef.current !== null) {
                setRect(null)
            }
            return
        }

        const newRect = selection.getRangeAt(0).getBoundingClientRect()
        if (
            rectRef.current?.x === newRect.x
            && rectRef.current?.y === newRect.y
            && rectRef.current?.width === newRect.width
            && rectRef.current?.height === newRect.height
        ) {
            return
        }
        setRect(newRect)
    }

    React.useEffect(() => {
        if (!active) { return }

        updateSelectionRect()
        document.addEventListener('selectionchange', updateSelectionRect)
        return () => {
            document.removeEventListener('selectionchange', updateSelectionRect)
        }
    }, [active])

    React.useEffect(updateSelectionRect)

    return active ? rect : null
}

export function useStable<T>(value: T, equal: (l: T, r: T) => boolean = _.isEqual) {
    const prevRef = React.useRef(value)
    const prevValue = prevRef.current
    const stableValue = equal(prevValue, value) ? prevValue : value
    prevRef.current = stableValue
    return stableValue
}