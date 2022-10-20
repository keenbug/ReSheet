import * as React from 'react'

export type Environment = { [varName: string]: any }

export const BlockTag = Symbol('block')
export const isBlock = (obj): obj is Block<unknown> => obj?.[BlockTag] === BlockTag

export interface BlockViewerProps<State> {
    env: Environment
    state: State
    update: (action: (state: State) => State) => void
}

export type BlockViewer<State> =
    (props: BlockViewerProps<State>) => JSX.Element

export interface Block<State> {
    init: State
    view: BlockViewer<State>
    getResult(state: State, env: Environment): any
    fromJSON(json: {}, env: Environment): State
    toJSON(state: State): {}
}

export const create = <State>(description: Block<State>) =>
    ({ ...description, [BlockTag]: BlockTag })