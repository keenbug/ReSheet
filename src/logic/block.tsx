import * as React from 'react'
import { ErrorBoundary } from '../ui/value'

export type Environment = { [varName: string]: any }
export const emptyEnv: Environment = Object.create(null)

export const BlockTag = Symbol('block')
export const isBlock = (obj): obj is BlockDesc<unknown> => obj?.[BlockTag] === BlockTag

export type BlockUpdater<State> =
    (action: (state: State) => State) => void

export interface BlockViewerProps<State> {
    env: Environment
    state: State
    update: BlockUpdater<State>
}

export type BlockViewer<State> =
    (props: BlockViewerProps<State>) => JSX.Element

export interface BlockDesc<State> {
    init: State
    view: BlockViewer<State>
    getResult(state: State, env: Environment): any
    fromJSON(json: any, env: Environment): State
    toJSON(state: State): {}
}

export function create<State>(description: BlockDesc<State>) {
    return {
        ...description,
        [BlockTag]: BlockTag,
        view(props: BlockViewerProps<State>) {
            return (
                <ErrorBoundary title="There was an error in this block">
                    {React.createElement(description.view, props)}
                </ErrorBoundary>
            )
        },
        fromJSON(json: any, env: Environment) {
            try { return description.fromJSON(json, env) }
            catch (e) {
                console.warn("Could not load JSON:", e)
                console.log(e.stack)
                return description.init
            }
        },
        toJSON(state: State) {
            try { return description.toJSON(state) }
            catch (e) {
                console.warn("Could not convert to JSON:", e)
                console.log(e.stack)
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
