export type Result =
    | { type: 'immediate', value: any }
    | { type: 'promise', cancel(): void } & PromiseResult

export type PromiseResult =
    | { state: 'pending' }
    | { state: 'failed', error: any }
    | { state: 'finished', value: any }

export const Pending = Symbol('Pending')

export function getResultValue(result: Result) {
    switch (result.type) {
        case 'immediate':
            return result.value

        case 'promise':
            switch (result.state) {
                case 'pending':
                    return Pending
                
                case 'failed':
                    return result.error
                
                case 'finished':
                    return result.value
            }
    }
}


export function PromiseResult(promise: Promise<any>, resultUpdateCallback: (result: Result) => void): Result {
    let cancelled = false

    function cancel() { cancelled = true }

    promise.then(
        (value: any) => {
            if (cancelled) { return }
            resultUpdateCallback({
                type: 'promise',
                state: 'finished',
                value,
                cancel,
            })
        },
        (error: any) => {
            if (cancelled) { return }
            resultUpdateCallback({
                type: 'promise',
                state: 'failed',
                error,
                cancel,
            })
        }
    )

    return {
        type: 'promise',
        state: 'pending',
        cancel,
    }
}

export function ImmediateResult(value: any): Result {
    return { type: 'immediate', value }
}


export function resultFrom(value: any, resultUpdateCallback: (result: Result) => void): Result {
    if (isPromise(value)) {
        return PromiseResult(value, resultUpdateCallback)
    }
    else {
        return ImmediateResult(value)
    }
}


export function isPromise(value: any) {
    return typeof value?.then === 'function'
}
