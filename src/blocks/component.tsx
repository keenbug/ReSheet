import * as React from 'react'

import { Block, BlockHandle, BlockDispatcher, ViewerProps, Environment, BlockAction } from '@resheet/core/block'
import { ErrorBoundary, ErrorInspector } from '@resheet/code/value'
import { ErrorView } from '@resheet/code/ui'

export type BlockComponent<State> = React.FC<ViewerProps<State> & React.RefAttributes<BlockHandle>>

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

    const Component = React.forwardRef<BlockHandle, ViewerProps<State>>(
        function Component({ state, dispatch, env}, ref) {
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

            const safeDispatch = React.useCallback((action: BlockAction<State>) => {
                dispatch((state, context) => {
                    try {
                        return action(state, context)
                    }
                    catch (error) {
                        reportError("Block: Last action failed", error)
                        return { state }
                    }
                })
            }, [dispatch, setLastError])

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
                            dispatch: safeDispatch,
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
        view(props: ViewerProps<State> & { ref?: React.Ref<BlockHandle>, key?: React.Key }) {
            return <Component {...props} />
        },
        fromJSON(json: any, dispatch: BlockDispatcher<State>, env: Environment) {
            function safeDispatch(action: BlockAction<State>) {
                dispatch((state, context) => {
                    try {
                        return action(state, context)
                    }
                    catch (e) {
                        reportError("Block: Could not update after fromJSON", e)
                        return { state }
                    }
                })
            }
            try { return block.fromJSON(json, safeDispatch, env) }
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
        recompute(state, dispatch, env, changedVars) {
            function safeDispatch(action: BlockAction<State>) {
                dispatch((state, context) => {
                    try {
                        return action(state, context)
                    }
                    catch (e) {
                        reportError("Block: Could not update after recompute", e)
                        return { state }
                    }
                })
            }
            try { return block.recompute(state, safeDispatch, env, changedVars) }
            catch (e) {
                reportError("Block: Could not recompute block", e)
                return { state, invalidated: false }
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
