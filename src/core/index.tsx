import * as React from 'react'

import { ValidationError, Validator, ValidatorObj, validate } from '@tables/util/validate'

export type Environment = { [varName: string]: any }
export const emptyEnv: Environment = Object.create(null)

const BlockTag = Symbol('block')
export const isBlock = (obj): obj is Block<unknown> => obj?.[BlockTag] === BlockTag

export interface BlockRef {
    focus(options?: FocusOptions): void
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
    recompute(state: State, update: BlockUpdater<State>, env: Environment): State
    getResult(state: State): any
    fromJSON(json: any, update: BlockUpdater<State>, env: Environment): State
    toJSON(state: State): any
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
    recompute(state: State, update: BlockUpdater<State>, env: Environment): State
    getResult(state: State): any
    fromJSON(json: any, update: BlockUpdater<State>, env: Environment): State
    toJSON(state: State): any
}

export function create<State>(description: BlockDesc<State>): Block<State> {
    const forwardRefView = React.forwardRef(description.view)
    return {
        [BlockTag]: BlockTag,
        init: description.init,
        view(props: BlockViewerProps<State> & { ref?: React.Ref<BlockRef>, key?: React.Key }) {
            return React.createElement(forwardRefView, props)
        },
        fromJSON(json: any, update: BlockUpdater<State>, env: Environment) {
            function safeUpdate(action: (state: State) => State) {
                update(state => {
                    try {
                        return action(state)
                    }
                    catch (e) {
                        console.warn("Could not update after fromJSON:", e, e?.stack)
                        return state
                    }
                })
            }
            try { return description.fromJSON(json, safeUpdate, env) }
            catch (e) {
                if (e instanceof ValidationError) {
                    console.warn("Could not load JSON\n" + e.toString(), e.stack, '\nJSON:', json)
                }
                else {
                    console.warn("Could not load JSON:", e, e?.stack, '\nJSON:', json)
                }
                return description.init
            }
        },
        toJSON(state: State) {
            try { return description.toJSON(state) }
            catch (e) {
                console.warn("Could not convert to JSON:", e, e?.stack, '\nState:', state)
                return null
            }
        },
        getResult(state) {
            try { return description.getResult(state) }
            catch (e) {
                console.warn("Could not get block result:", e, e?.stack)
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
                        console.warn("Could not update after recompute:", e, e?.stack)
                        return state
                    }
                })
            }
            try { return description.recompute(state, safeUpdate, env) }
            catch (e) {
                console.warn("Could not recompute block:", e, e?.stack)
                return state
            }
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


export function fieldUpdater<State extends object, Field extends keyof State>(
    fieldName: Field,
    updater: BlockUpdater<State>,
): BlockUpdater<State[Field]> {
    return function subUpdater(action: (fieldState: State[Field]) => State[Field]) {
        updater(state => ({
            ...state,
            [fieldName]: action(state[fieldName]),
        }))
    }
}

export function subUpdater<State, Input>(
    updateSub: (state: State, input: Input) => State,
    updater: BlockUpdater<State>,
): (input: Input) => void {
    return function subUpdate(input: Input) {
        updater(state => updateSub(state, input))
    }
}

export function updaterToSetter<State>(
    updater: BlockUpdater<State>,
): (newState: State) => void {
    return function setState(newState: State) {
        updater(() => newState)
    }
}

export function updateWhenMatch(
    schema: Validator,
    updater: BlockUpdater<any>,
): BlockUpdater<any> {
    return function updateMatch(action: (state: any) => any) {
        updater(state => {
            if (validate(schema, state)) {
                return action(state)
            }
            return state
        })
    }
}

export function updateCaseField<
    State extends object,
    Discriminator extends Partial<State & ValidatorObj>,
    Field extends keyof Extract<State, Discriminator>,
>(
    discriminator: Discriminator,
    fieldName: Field,
    updater: BlockUpdater<State>,
): BlockUpdater<Extract<State, Discriminator>[Field]> {
    return fieldUpdater<Extract<State, Discriminator>, Field>(
        fieldName,
        updateWhenMatch(discriminator, updater),
    )
}