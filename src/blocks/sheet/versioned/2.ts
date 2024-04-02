import * as block from '@resheet/core/block'
import { BlockDispatcher } from "@resheet/core/block"

import * as Multiple from '@resheet/core/multiple'
import { BlockEntry } from "@resheet/core/multiple"

import { any, array, oneOf, strict } from "@resheet/util/validate"
import { addRevision } from "@resheet/util/serialize"
import { fieldDispatcher } from '@resheet/util/dispatch'

import { ParseV1, SheetBlockStateV1, v1 } from './1'


function typed<Obj extends object>(revision: number, obj: Obj): Obj {
    return {
        t: 'resheet.sheet',
        v: revision,
        ...obj,
    }
}


// Revisions

export interface SheetBlockStateV2<InnerBlockState> {
    readonly lines: SheetBlockLineV2<InnerBlockState>[]
}

export interface SheetBlockLineV2<InnerBlockState> extends BlockEntry<InnerBlockState> {
    readonly id: number
    readonly name: string
    readonly state: InnerBlockState

    readonly width: LineWidthV2
    readonly visibility: LineVisibilityV2
}

export type LineWidthV2 =
    | "narrow"
    | "wide"
    | "full"

export const WIDTH_STATES_V2: LineWidthV2[] = [
    "narrow",
    "wide",
    "full",
]

export type LineVisibilityV2 =
    | "block"
    | "result"

export const VISIBILITY_STATES_V2: LineVisibilityV2[] = [
    "block",
    "result",
]

const lineWidthSchemaV2 = oneOf(...WIDTH_STATES_V2)
const visibilitySchemaV2 = oneOf(...VISIBILITY_STATES_V2)
const sheetLineSchemaV2 = strict(Multiple.entryJSONV(any, { width: lineWidthSchemaV2, visibility: visibilitySchemaV2 }))
const sheetSchemaV2 = array(sheetLineSchemaV2)

export type ParseV2 = <State>(
    dispatch: BlockDispatcher<SheetBlockStateV2<State>>,
    env: block.Environment,
    innerBlock: block.Block<State>,
) => SheetBlockStateV2<State>

function parseV2(json: any): ParseV2 {
    return <State>(dispatch: BlockDispatcher<SheetBlockStateV2<State>>, env: block.Environment, innerBlock: block.Block<State>): SheetBlockStateV2<State> => {
        const dispatchLines = fieldDispatcher('lines', dispatch)

        return {
            lines: (
                Multiple.fromJSON(
                    json,
                    dispatchLines,
                    env,
                    innerBlock,
                    (entry, { width, visibility }) => ({
                        ...entry,
                        width,
                        visibility,
                    }),
                )
            ),
        }
    }
}

function upgradeV2(before: ParseV1): ParseV2 {
    return <State>(dispatch: BlockDispatcher<SheetBlockStateV2<State>>, env: block.Environment, innerBlock: block.Block<State>): SheetBlockStateV2<State> => {
        function dispatchV1(actionV1: block.BlockAction<SheetBlockStateV1<State>>) {
            dispatch((stateV2, context) => {
                const { state: newStateV1, ...output } = actionV1(stateV2, context)
                const newStateV2: SheetBlockStateV2<State> = {
                    lines: newStateV1.lines.map(lineV1 => ({
                        ...lineV1,
                        width: stateV2.lines.find(lineV2 => lineV2.id === lineV1.id)?.width ?? "narrow",
                    }))
                }
                return {
                    state: newStateV2,
                    ...output,
                }
            })
        }

        const stateV1 = before(dispatchV1, env, innerBlock)
        return {
            lines: stateV1.lines.map(lineV1 => ({
                ...lineV1,
                width: "narrow",
            }))
        }
    }
}

export const v2 = addRevision<ParseV2, ParseV1>(v1, {
    schema: typed(2, { lines: sheetSchemaV2 }),
    parse({ lines }) {
        return parseV2(lines)
    },
    upgrade(before) {
        return upgradeV2(before)
    },
})

export type {
    SheetBlockStateV2 as SheetBlockState,
    SheetBlockLineV2 as SheetBlockLine,
    LineVisibilityV2 as LineVisibility,
    LineWidthV2 as LineWidth,
}
export {
    VISIBILITY_STATES_V2 as VISIBILITY_STATES,
    WIDTH_STATES_V2 as WIDTH_STATES,
    v2 as fromJSON,
}

export function toJSON<Inner>(state: SheetBlockStateV2<Inner>, innerBlock: block.Block<Inner>) {
    return typed(2, {
        lines: state.lines.map(
            ({ id, name, visibility, width, state }) => (
                {
                    id,
                    name,
                    visibility,
                    width,
                    state: innerBlock.toJSON(state),
                }
            )
        )
    })
}