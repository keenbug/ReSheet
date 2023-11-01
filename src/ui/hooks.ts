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

export function useAutoretrigger(onTrigger: () => void) {
    const timeoutRef = React.useRef<null | number>(null)

    React.useEffect(() => {
        return () => {
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [timeoutRef])

    function triggerPeriodically(period: number) {
        return () => {
            onTrigger()
            timeoutRef.current = setTimeout(triggerPeriodically(period * 0.99), period)
        }
    }

    function triggerStart() {
        onTrigger()
        timeoutRef.current = setTimeout(triggerPeriodically(100), 1000)
    }

    function triggerStop() {
        if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current)
        }
    }

    return [triggerStart, triggerStop]
}
