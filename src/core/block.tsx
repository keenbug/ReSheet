import * as React from 'react'

import { Validator, ValidatorObj, validate } from '@tables/util/validate'
import { Action, Dispatcher, fieldDispatcher, useDispatcher } from '@tables/util/dispatch'

export type Environment = { [varName: string]: any }
export const emptyEnv: Environment = Object.create(null)

const BlockTag = Symbol('block')
export const isBlock = (obj): obj is Block<unknown> => obj?.[BlockTag] === BlockTag

export interface BlockHandle {
    focus(options?: FocusOptions): void
}

export type BlockAction<State> = Action<State, [], {}>

export type BlockDispatcher<State> = Dispatcher<State, [], {}>

export const useBlockDispatcher = useDispatcher

export interface ViewerProps<State> {
    env: Environment
    state: State
    dispatch: BlockDispatcher<State>
}

export type ViewerDesc<State> =
    (props: ViewerProps<State> & { dispatch: BlockDispatcher<State> }, ref?: React.Ref<BlockHandle>) => JSX.Element

export interface BlockDef<State> {
    init: State
    view: ViewerDesc<State>
    recompute(state: State, dispatch: BlockDispatcher<State>, env: Environment): State
    getResult(state: State): any
    fromJSON(json: any, dispatch: BlockDispatcher<State>, env: Environment): State
    toJSON(state: State): any
}

export type Viewer<State> =
    (props: ViewerProps<State> & React.RefAttributes<BlockHandle> & { key?: React.Key }) => JSX.Element


// Why does fromJSON need dispatch()?
//
// During loading a file, its content needs to be computed. JSExpr Blocks'
// values can change over time without user interaction, when their code is
// async (using Promises). Therefore they need an dispatch procedure, for
// computation result dispatchs, which they compute during `fromJSON`.
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
    view: Viewer<State>
    recompute(state: State, dispatch: BlockDispatcher<State>, env: Environment): State
    getResult(state: State): any
    fromJSON(json: any, dispatch: BlockDispatcher<State>, env: Environment): State
    toJSON(state: State): any
}

export function create<State>(description: BlockDef<State>): Block<State> {
    const forwardRefView = React.forwardRef(description.view)
    return {
        [BlockTag]: BlockTag,
        ...description,
        view(props: ViewerProps<State> & React.RefAttributes<BlockHandle> & { key?: React.Key }) {
            return React.createElement(forwardRefView, props)
        },
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



export function dispatcherToSetter<State>(
    dispatch: Dispatcher<State>,
): (newState: State) => void {
    return function setState(newState: State) {
        dispatch(() => ({ state: newState }))
    }
}

export function dispatchWhenMatch(
    schema: Validator,
    dispatch: Dispatcher<any>,
): Dispatcher<any> {
    return function dispatchMatch(action: (state: any) => any) {
        dispatch(state => {
            if (validate(schema, state)) {
                return action(state)
            }
            return { state }
        })
    }
}

export function dispatchCaseField<
    State extends object,
    Discriminator extends Partial<State & ValidatorObj>,
    Field extends keyof Extract<State, Discriminator>,
>(
    discriminator: Discriminator,
    fieldName: Field,
    dispatch: Dispatcher<State>,
): Dispatcher<Extract<State, Discriminator>[Field]> {
    return fieldDispatcher<Extract<State, Discriminator>, Field>(
        fieldName,
        dispatchWhenMatch(discriminator, dispatch),
    )
}