import * as block from '@tables/core'
import { any, boolean, defined, number, string, validatorSwitch } from '@tables/util/validate'
import { addRevision, addValidator } from '@tables/util/serialize'

import { Result, resultFrom } from '@tables/code/result'
import { computeExpr } from '@tables/code/compute'


function typed<Obj extends object>(revision: number, obj: Obj) {
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
    | { type: 'block', isInstantiated: true, code: string, block: block.Block<unknown>, state: unknown }
    | { type: 'text', tag: string, text: string }
    | { type: 'checkbox', checked: boolean, text: string }


export function noteFromJSONV0(json: any, update: block.BlockUpdater<NoteTypeV0>, env: block.Environment): NoteTypeV0 {
    const updateExprResult = block.updateCaseField({ type: 'expr' }, 'result', update)
    const updateBlockResult = block.updateCaseField({ type: 'block', isInstantiated: false }, 'result', update)
    const updateBlockState = block.updateCaseField({ type: 'block', isInstantiated: true }, 'state', update)

    return validatorSwitch<NoteTypeV0>(json,
        [{ type: 'expr', code: string }, ({ code }) => {
            const result = resultFrom(computeExpr(code, env), block.updaterToSetter(updateExprResult))
            return { type: 'expr', code, result }
        }],

        [{ type: 'block', isInstantiated: true, code: string, state: any }, ({ code, state: stateJson }) => {
            function setBlockFromResult(result: Result) {
                update(() => {
                    if (result.type === 'immediate' && block.isBlock(result.value)) {
                        const state = result.value.fromJSON(stateJson, updateBlockResult, env)
                        return { type: 'block', isInstantiated: true, code, block: result.value, state }
                    }

                    if (result.type === 'promise' && result.state === 'finished' && block.isBlock(result.value)) {
                        const state = result.value.fromJSON(stateJson, updateBlockResult, env)
                        return { type: 'block', isInstantiated: true, code, block: result.value, state }
                    }

                    return { type: 'block', isInstantiated: false, code, result }
                })
            }

            const result = resultFrom(computeExpr(code, env), setBlockFromResult)
            if (result.type === 'immediate' && block.isBlock(result.value)) {
                const state = result.value.fromJSON(stateJson, updateBlockState, env)
                return { type: 'block', isInstantiated: true, code, block: result.value, state }
            }
            else {
                return { type: 'block', isInstantiated: false, code, result }
            }
        }],

        [{ type: 'block', isInstantiated: false, code: string }, ({ code }) => {
            const result = resultFrom(computeExpr(code, env), block.updaterToSetter(updateBlockResult))
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
    update: block.BlockUpdater<NoteModelV0>,
    env: block.Environment,
}) => NoteModelV0

const vPre1 = addRevision<VPre1Parse, VPre0Parse>(vPre0, {
    schema: { level: number, input: string, interpreted: defined },
    parse: ({ level, input, interpreted }) => ({ update, env }) => {
        const updateNote = block.fieldUpdater('note', update)
        const note = noteFromJSONV0(interpreted, updateNote, env)
        return { level, input, note }
    },
    upgrade: (before: VPre0Parse) => ({ modelFromInput }) => {
        return before(modelFromInput)
    }
})


type VPre2Parse = VPre1Parse

const vPre2 = addRevision<VPre2Parse, VPre1Parse>(vPre1, {
    schema: { v: 0, level: number, input: string, note: defined },
    parse: ({ level, input, note: noteJson }) => ({ update, env }) => {
        const updateNote = block.fieldUpdater('note', update)
        const note = noteFromJSONV0(noteJson, updateNote, env)
        return { level, input, note }
    },
    upgrade: before => before,
})


type V0Parse = VPre2Parse

const v0 = addRevision<V0Parse, VPre1Parse>(vPre2, {
    schema: typed(0, { level: number, input: string, note: defined }),
    parse: ({ level, input, note: noteJson }) => ({ update, env }) => {
        const updateNote = block.fieldUpdater('note', update)
        const note = noteFromJSONV0(noteJson, updateNote, env)
        return { level, input, note }
    },
    upgrade: before => before,
})


// Export current Revision

export type {
    NoteModelV0 as NoteModel,
    NoteTypeV0 as NoteType,
}

export {
    v0 as fromJSON,
}

export function toJSON(state: NoteModelV0) {
    function noteToJSON(note: NoteTypeV0) {
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

    return typed(0, {
        level: state.level,
        input: state.input,
        note: noteToJSON(state.note),
    })
}
