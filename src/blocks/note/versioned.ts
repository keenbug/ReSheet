import * as block from '@resheet/core/block'
import { any, boolean, defined, number, string, validatorSwitch } from '@resheet/util/validate'
import { addRevision, addValidator } from '@resheet/util/serialize'
import { fieldDispatcher } from '@resheet/util/dispatch'

import { Result, resultFrom } from '@resheet/code/result'
import { computeExpr } from '@resheet/code/compute'

import { SafeBlock, safeBlock } from '../component'


function typed<Obj extends object>(revision: number, obj: Obj) {
    return {
        t: 'resheet.note',
        v: revision,
        ...obj,
    }
}

function typedTables<Obj extends object>(revision: number, obj: Obj) {
    return {
        t: 'tables.note',
        v: revision,
        ...obj,
    }
}


// Revisions

interface NoteModelV0 {
    level: number
    input: string
    note: NoteTypeV0
}

type NoteTypeV0 =
    | { type: 'expr', code: string, result: Result }
    | { type: 'block', isInstantiated: false, code: string, result: Result, lastState?: any }
    | { type: 'block', isInstantiated: true, code: string, block: SafeBlock<unknown>, state: unknown }
    | { type: 'text', tag: string, text: string }
    | { type: 'checkbox', checked: boolean, text: string }


export function noteFromJSONV0(json: any, dispatch: block.BlockDispatcher<NoteTypeV0>, env: block.Environment): NoteTypeV0 {
    const dispatchExprResult = block.dispatchCaseField({ type: 'expr' }, 'result', dispatch)
    const dispatchBlockResult = block.dispatchCaseField({ type: 'block', isInstantiated: false }, 'result', dispatch)
    const dispatchBlockState = block.dispatchCaseField({ type: 'block', isInstantiated: true }, 'state', dispatch)

    return validatorSwitch<NoteTypeV0>(json,
        [{ type: 'expr', code: string }, ({ code }) => {
            const result = resultFrom(computeExpr(code, env), block.dispatcherToSetter(dispatchExprResult))
            return { type: 'expr', code, result }
        }],

        [{ type: 'block', isInstantiated: true, code: string, state: any }, ({ code, state: stateJson }) => {
            function setBlockFromResult(result: Result) {
                dispatch(() => {
                    if (result.type === 'immediate' && block.isBlock(result.value)) {
                        const state = result.value.fromJSON(stateJson, dispatchBlockResult, env)
                        return {
                            state: { type: 'block', isInstantiated: true, code, block: safeBlock(result.value), state },
                        }
                    }

                    if (result.type === 'promise' && result.state === 'finished' && block.isBlock(result.value)) {
                        const state = result.value.fromJSON(stateJson, dispatchBlockResult, env)
                        return {
                            state: { type: 'block', isInstantiated: true, code, block: safeBlock(result.value), state },
                        }
                    }

                    return {
                        state: { type: 'block', isInstantiated: false, code, result },
                    }
                })
            }

            const result = resultFrom(computeExpr(code, env), setBlockFromResult)
            if (result.type === 'immediate' && block.isBlock(result.value)) {
                const state = result.value.fromJSON(stateJson, dispatchBlockState, env)
                return { type: 'block', isInstantiated: true, code, block: safeBlock(result.value), state }
            }
            else {
                return { type: 'block', isInstantiated: false, code, result }
            }
        }],

        [{ type: 'block', isInstantiated: false, code: string }, ({ code }) => {
            const result = resultFrom(computeExpr(code, env), block.dispatcherToSetter(dispatchBlockResult))
            return { type: 'block', isInstantiated: false, code, result }
        }],

        [{ type: 'text', tag: string, text: string }, ({ tag, text }) => {
            return { type: 'text', tag, text }
        }],

        [{ type: 'checkbox', checked: boolean, text: string }, ({ checked, text }) => {
            return { type: 'checkbox', checked, text }
        }],

        [any, json => {
            return {
                type: 'text',
                tag: 'p',
                text: [
                    'Could not load note from JSON:',
                    '```',
                    JSON.stringify(json, undefined, 2),
                    '```',
                ].join('\n'),
            }
        }],
    )
}



type VPre0Parse = (
    modelFromInput: (level: number, input: string) => NoteModelV0,
) => NoteModelV0

const vPre0 = addValidator<VPre0Parse>(
    { level: number, input: string },
    ({ level, input }) => modelFromInput => {
        return modelFromInput(level, input)
    }
)


type VPre1Parse = (args: {
    modelFromInput(level: number, input: string): NoteModelV0,
    dispatch: block.BlockDispatcher<NoteModelV0>,
    env: block.Environment,
}) => NoteModelV0

const vPre1 = addRevision<VPre1Parse, VPre0Parse>(vPre0, {
    schema: { level: number, input: string, interpreted: defined },
    parse: ({ level, input, interpreted }) => ({ dispatch, env }) => {
        const dispatchNote = fieldDispatcher('note', dispatch)
        const note = noteFromJSONV0(interpreted, dispatchNote, env)
        return { level, input, note }
    },
    upgrade: (before: VPre0Parse) => ({ modelFromInput }) => {
        return before(modelFromInput)
    }
})


type VPre2Parse = VPre1Parse

const vPre2 = addRevision<VPre2Parse, VPre1Parse>(vPre1, {
    schema: { v: 0, level: number, input: string, note: defined },
    parse: ({ level, input, note: noteJson }) => ({ dispatch, env }) => {
        const dispatchNote = fieldDispatcher('note', dispatch)
        const note = noteFromJSONV0(noteJson, dispatchNote, env)
        return { level, input, note }
    },
    upgrade: before => before,
})


type V0Parse = VPre2Parse

const v0 = addRevision<V0Parse, VPre1Parse>(vPre2, {
    schema: typedTables(0, { level: number, input: string, note: defined }),
    parse: ({ level, input, note: noteJson }) => ({ dispatch, env }) => {
        const dispatchNote = fieldDispatcher('note', dispatch)
        const note = noteFromJSONV0(noteJson, dispatchNote, env)
        return { level, input, note }
    },
    upgrade: before => before,
})


type V1Parse = V0Parse

type NoteModelV1 = NoteModelV0
type NoteTypeV1 = NoteTypeV0

const v1 = addRevision<V1Parse, V0Parse>(v0, {
    schema: typed(1, { level: number, input: string, note: defined }),
    parse: ({ level, input, note: noteJson }) => ({ dispatch, env }) => {
        const dispatchNote = fieldDispatcher('note', dispatch)
        const note = noteFromJSONV0(noteJson, dispatchNote, env)
        return { level, input, note }
    },
    upgrade: before => before,
})


// Export current Revision

export type {
    NoteModelV1 as NoteModel,
    NoteTypeV1 as NoteType,
}

export {
    v1 as fromJSON,
}

export function toJSON(state: NoteModelV1) {
    function noteToJSON(note: NoteTypeV1) {
        switch (note.type) {
            case 'expr':
                return { type: 'expr', code: note.code }

            case 'block':
                if (note.isInstantiated) {
                    return { 
                        type: 'block',
                        isInstantiated: true,
                        code: note.code,
                        state: note.block.toJSON(note.state),
                    }
                }
                else {
                    return { type: 'block', isInstantiated: false, code: note.code }
                }

            case 'text':
            case 'checkbox':
                return note
        }
    }

    return typed(1, {
        level: state.level,
        input: state.input,
        note: noteToJSON(state.note),
    })
}
