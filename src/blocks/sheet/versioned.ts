import * as block from '@resheet/core/block'
import { BlockDispatcher } from "@resheet/core/block"

import * as Multiple from '@resheet/core/multiple'
import { BlockEntry } from "@resheet/core/multiple"

import { any, array, oneOf, strict } from "@resheet/util/validate"
import { addRevision, addValidator } from "@resheet/util/serialize"
import { fieldDispatcher } from '@resheet/util/dispatch'


function typed<Obj extends object>(revision: number, obj: Obj): Obj {
    return {
        t: 'resheet.sheet',
        v: revision,
        ...obj,
    }
}

function typedTables<Obj extends object>(revision: number, obj: Obj): Obj {
    return {
        t: 'tables.sheet',
        v: revision,
        ...obj,
    }
}


// Revisions

interface SheetBlockStateV0<InnerBlockState> {
    readonly lines: SheetBlockLineV0<InnerBlockState>[]
}

interface SheetBlockLineV0<InnerBlockState> extends BlockEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState

    readonly visibility: LineVisibilityV0
}

type LineVisibilityV0 =
    | "block"
    | "result"

const VISIBILITY_STATES_V0: LineVisibilityV0[] = [
    "block",
    "result",
]

const visibilitySchemaV0 = oneOf(...VISIBILITY_STATES_V0)
const sheetLineSchemaV0 = strict(Multiple.entryJSONV(any, { visibility: visibilitySchemaV0 }))
const sheetSchemaV0 = array(sheetLineSchemaV0)

const vPre = addValidator(sheetSchemaV0, parseV0)

function parseV0(json: any) {
    return <State>(dispatch: BlockDispatcher<SheetBlockStateV0<State>>, env: block.Environment, innerBlock: block.Block<State>): SheetBlockStateV0<State> => {
        const dispatchLines = fieldDispatcher('lines', dispatch)

        return {
            lines: (
                Multiple.fromJSON(
                    json,
                    dispatchLines,
                    env,
                    innerBlock,
                    (entry, { visibility }) => ({
                        ...entry,
                        visibility: VISIBILITY_STATES_V0.includes(visibility) ? visibility : VISIBILITY_STATES_V0[0],
                    }),
                )
            ),
        }
    }
}

const v0 = addRevision(vPre, {
    schema: typedTables(0, { lines: sheetSchemaV0 }),
    parse({ lines }) {
        return parseV0(lines)
    },
    upgrade(before) {
        return before
    },
})

const v1 = addRevision(v0, {
    schema: typed(1, { lines: sheetSchemaV0 }),
    parse({ lines }) {
        return parseV0(lines)
    },
    upgrade(before) {
        return before
    },
})


// Export current Revision

export type {
    SheetBlockStateV0 as SheetBlockState,
    SheetBlockLineV0 as SheetBlockLine,
    LineVisibilityV0 as LineVisibility,
}
export {
    VISIBILITY_STATES_V0 as VISIBILITY_STATES,
    v1 as fromJSON,
}

export function toJSON<Inner>(state: SheetBlockStateV0<Inner>, innerBlock: block.Block<Inner>) {
    return typed(1, {
        lines: state.lines.map(
            ({ id, name, visibility, state }) => (
                {
                    id,
                    name,
                    visibility,
                    state: innerBlock.toJSON(state),
                }
            )
        )
    })
}