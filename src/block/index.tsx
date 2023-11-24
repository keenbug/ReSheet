import * as React from 'react'
import { ErrorBoundary } from '../ui/value'

export type Environment = { [varName: string]: any }
export const emptyEnv: Environment = Object.create(null)

export const BlockTag = Symbol('block')
export const isBlock = (obj): obj is Block<unknown> => obj?.[BlockTag] === BlockTag

export interface BlockRef {
    focus(): void
}

export type BlockUpdater<State> =
    (action: (state: State) => State) => void

export interface BlockViewerProps<State> {
    env: Environment
    state: State
    update: BlockUpdater<State>
}

export type BlockViewerDesc<State> =
    (props: BlockViewerProps<State>, ref?: React.Ref<BlockRef>) => JSX.Element

export interface BlockDesc<State> {
    init: State
    view: BlockViewerDesc<State>
    onEnvironmentChange(state: State, update: BlockUpdater<State>, env: Environment): State
    getResult(state: State, env: Environment): any
    fromJSON(json: any, env: Environment): State
    toJSON(state: State): {}
}

export type BlockViewer<State> =
    (props: BlockViewerProps<State> & { ref?: React.Ref<BlockRef>, key?: React.Key }) => JSX.Element

export interface Block<State> {
    [BlockTag]: typeof BlockTag
    init: State
    view: BlockViewer<State>
    onEnvironmentChange(state: State, update: BlockUpdater<State>, env: Environment): State
    getResult(state: State, env: Environment): any
    fromJSON(json: any, env: Environment): State
    toJSON(state: State): {}
}

export function create<State>(description: BlockDesc<State>): Block<State> {
    const forwardRefView = React.forwardRef(description.view)
    return {
        ...description,
        [BlockTag]: BlockTag,
        view(props: BlockViewerProps<State> & { ref?: React.Ref<BlockRef>, key?: React.Key }) {
            return (
                <ErrorBoundary title="There was an error in this block">
                    {React.createElement(forwardRefView, props)}
                </ErrorBoundary>
            )
        },
        fromJSON(json: any, env: Environment) {
            try { return description.fromJSON(json, env) }
            catch (e) {
                console.warn("Could not load JSON:", e, e.stack, '\nJSON:', json)
                return description.init
            }
        },
        toJSON(state: State) {
            try { return description.toJSON(state) }
            catch (e) {
                console.warn("Could not convert to JSON:", e, e.stack, '\nState:', state)
                return null
            }
        }
    }
}


export function mapWithEnv<Item, Out>(
    array: Array<Item>,
    fn: (item: Item, env: Environment) => { out: Out, env: Environment },
    startEnv: Environment = emptyEnv,
): Array<Out> {
    const result = []
    let currentEnv = startEnv
    array.forEach(item => {
        const { out, env } = fn(item, currentEnv)
        result.push(out)
        currentEnv = { ...currentEnv, ...env }
    })
    return result
}
