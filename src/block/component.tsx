import * as React from 'react'

import { ErrorBoundary, ErrorInspector } from '../ui/value'
import { ErrorView } from '../ui/utils'
import { Block as BlockModel, BlockRef, Environment } from '.'

export interface BlockProps<State> {
    state: State
    update: (action: (state: State) => State) => void
    block: BlockModel<State>
    env: Environment
    blockRef?: React.Ref<BlockRef>
}

export function Block<State>({ state, update, block, env, blockRef }: BlockProps<State>) {
    const [updateError, setUpdateError] = React.useState<null | Error>(null)

    const safeUpdate = React.useCallback(action => {
        update(state => {
            try {
                return action(state)
            }
            catch (error) {
                setUpdateError(error)
                return state
            }
        })
    }, [update, setUpdateError])

    return (
        <React.Fragment>
            <ViewInternalError
                title="Last action failed"
                error={updateError}
                onDismiss={() => setUpdateError(null)}
            />
            <ErrorBoundary title="There was an Error while rendering the Block">
                {block.view({
                    ref: blockRef,
                    state,
                    update: safeUpdate,
                    env,
                })}
            </ErrorBoundary>
        </React.Fragment>
    )
}



function ViewInternalError({ title, error, onDismiss }) {
    if (error === null) { return null }

    return (
        <ErrorView title={"Internal Error: " + title} error={error} className="sticky top-1 my-1 z-20 shadow-lg">
            <button onClick={onDismiss}>Dismiss</button>
            <ErrorInspector error={error} />
        </ErrorView>
    )
}
