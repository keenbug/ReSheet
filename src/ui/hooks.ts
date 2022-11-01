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
