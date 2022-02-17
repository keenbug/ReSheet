import * as React from 'react'

export type Environment = { [varName: string]: any }

export const BlockTag = Symbol('block')
export const isBlock = obj => obj?.[BlockTag] === BlockTag

export type BlockViewer<State> =
    (props: { env: Environment, state: State, setState: React.Dispatch<(state: State) => State> }) => JSX.Element

export interface Block<State> {
    init: State
    view: BlockViewer<State>
    getResult(state: State, env: Environment): any
    fromJSON(json: {}, env: Environment): State
    toJSON(state: State): {}
}

export const create = <State>(description: Block<State>) =>
    ({ ...description, [BlockTag]: BlockTag })