import * as React from 'react'

import { Block, BlockRef, BlockUpdater, BlockViewerProps, Environment } from '@tables/core'
import { ErrorBoundary, ErrorInspector } from '@tables/code/value'

import { ErrorView } from './utils/ui'

export type BlockComponent<State> = React.FC<BlockViewerProps<State> & React.RefAttributes<BlockRef>>

const SafeBlockTag = Symbol("SafeBlock")

export interface SafeBlock<State> extends Block<State> {
    [SafeBlockTag]: typeof SafeBlockTag
    Component: BlockComponent<State>
    $$UNSAFE_BLOCK: Block<State>
}

export function isSafeBlock(value: any): value is SafeBlock<unknown> {
    return value?.[SafeBlockTag] === SafeBlockTag
}

type BlockError = {
    reason: string,
    error: any,
}

type ErrorRef = {
    lostError: null | BlockError,
    reportError: null | ((error: BlockError) => void),
}

export function safeBlock<State>(block: Block<State>): SafeBlock<State> {
    if (isSafeBlock(block)) {
        return block as SafeBlock<State>
    }

    const errorRef: ErrorRef = {
        lostError: null,
        reportError: null,
    }

    function reportError(reason: string, error: any) {
        // prevent reporting inside a React update with setTimeout
        setTimeout(() => {
            if (errorRef.reportError) {
                errorRef.reportError({ reason, error })
            }
            else {
                console.warn(reason, error, error?.stack)
                errorRef.lostError = { reason, error }
            }
        })
    }

    const Component = React.forwardRef<BlockRef, BlockViewerProps<State>>(
        function Component({ state, update, env}, ref) {
            const [lastError, setLastError] = React.useState<null | BlockError>(null)

            React.useEffect(() => {
                const lostError = errorRef.lostError
                errorRef.lostError = null
                errorRef.reportError = setLastError
                if (lostError) {
                    setLastError(lostError)
                }
                return () => {
                    errorRef.reportError = null
                }
            }, [])

            const safeUpdate = React.useCallback(action => {
                update(state => {
                    try {
                        return action(state)
                    }
                    catch (error) {
                        reportError("Block: Last action failed", error)
                        return state
                    }
                })
            }, [update, setLastError])

            return (
                <React.Fragment>
                    {lastError &&
                        <ViewInternalError
                            title={lastError.reason}
                            error={lastError.error}
                            onDismiss={() => setLastError(null)}
                        />
                    }
                    <ErrorBoundary title="Block: Rendering failed">
                        {block.view({
                            ref,
                            state,
                            update: safeUpdate,
                            env,
                        })}
                    </ErrorBoundary>
                </React.Fragment>
            )
        }
    )
    return {
        ...block,
        [SafeBlockTag]: SafeBlockTag,
        $$UNSAFE_BLOCK: block,
        Component,
        view(props: BlockViewerProps<State> & { ref?: React.Ref<BlockRef>, key?: React.Key }) {
            return <Component {...props} />
        },
        fromJSON(json: any, update: BlockUpdater<State>, env: Environment) {
            function safeUpdate(action: (state: State) => State) {
                update(state => {
                    try {
                        return action(state)
                    }
                    catch (e) {
                        reportError("Block: Could not update after fromJSON", e)
                        return state
                    }
                })
            }
            try { return block.fromJSON(json, safeUpdate, env) }
            catch (e) {
                // TODO: show more error details: `e instanceof ValidationError && { details: e.toString(), json }`
                reportError("Block: Could not load JSON", e)
                return block.init
            }
        },
        toJSON(state: State) {
            try { return block.toJSON(state) }
            catch (e) {
                // TODO: show more error details: `{ state }`
                reportError("Block: Could not convert to JSON", e)
                return null
            }
        },
        getResult(state) {
            try { return block.getResult(state) }
            catch (e) {
                reportError("Block: Could not get result", e)
                return e
            }
        },
        recompute(state, update, env) {
            function safeUpdate(action: (state: State) => State) {
                update(state => {
                    try {
                        return action(state)
                    }
                    catch (e) {
                        reportError("Block: Could not update after recompute", e)
                        return state
                    }
                })
            }
            try { return block.recompute(state, safeUpdate, env) }
            catch (e) {
                reportError("Block: Could not recompute block", e)
                return state
            }
        },
    }
}



function ViewInternalError({ title, error, onDismiss }) {
    if (error === null) { return null }

    return (
        <ErrorView title={title} error={error} className="sticky top-1 my-1 z-20 shadow-lg">
            <button onClick={onDismiss}>Dismiss</button>
            <ErrorInspector error={error} />
        </ErrorView>
    )
}
