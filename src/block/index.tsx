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
    fromJSON(json: any, update: BlockUpdater<State>, env: Environment): State
    toJSON(state: State): {}
}

export type BlockViewer<State> =
    (props: BlockViewerProps<State> & { ref?: React.Ref<BlockRef>, key?: React.Key }) => JSX.Element


// Why does fromJSON need update()?
//
// During loading a file, its content needs to be computed. JSExpr Blocks'
// values can change over time without user interaction, when their code is
// async (using Promises). Therefore they need an update procedure, for
// computation result updates, which they compute during `fromJSON`.
//
// Why can't the content be computed after loading the file?
//
// A user can code a Block and then use it. The used Block's state will of
// course also be saved. But to load it, its definition needs to be computed.
// Then the `fromJSON` function can be retrieved and used to load its state from
// the file.
//
// (That's incidentally the reason why `fromJSON` also needs the Environment.)
export interface Block<State> {
    [BlockTag]: typeof BlockTag
    init: State
    view: BlockViewer<State>
    onEnvironmentChange(state: State, update: BlockUpdater<State>, env: Environment): State
    getResult(state: State, env: Environment): any
    fromJSON(json: any, update: BlockUpdater<State>, env: Environment): State
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
        fromJSON(json: any, update: BlockUpdater<State>, env: Environment) {
            try { return description.fromJSON(json, update, env) }
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
