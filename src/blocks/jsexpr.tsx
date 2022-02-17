import * as React from 'react'

import { JSComputation, JSComputationJSON, fcoBlockAdapter } from '../logic/components'
import { ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'
import { FCO } from '../logic/fc-object'
import { computeExpr } from '../logic/compute'


/**************** Code Actions **************/

export const setCodeExpr = (expr, block) =>
    block.update({ expr })

export const JSExprBlockFCO = FCO
    .combine(JSComputation)
    .combine(JSComputationJSON)
    .addMethods({
        view({ block, setBlock, env }) {
            const dispatch = (action, ...args) => {
                setBlock(block => action(...args, block))
            }
            return <JSExpr block={block} dispatch={dispatch} env={env} />
        },
    })

export const JSExprBlock = fcoBlockAdapter(JSExprBlockFCO)


/**************** UI *****************/

const JSExprContainer = classed<any>('div')`flex flex-col space-y-1 flex-1`

export const JSExpr = ({ block: code, dispatch, env }) => {
    const onUpdateExpr = expr => dispatch(setCodeExpr, expr)

    return (
        <JSExprContainer key={code.id}>
            <EditableCode code={code.expr} onUpdate={onUpdateExpr} />
            <ValueInspector value={computeExpr(code.expr, env)} />
        </JSExprContainer>
    )
}