import * as React from 'react'

import { ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'
import { computeExpr } from '../logic/compute'
import * as block from '../logic/block'


export const JSExprBlock = block.create<string>({
    init: "",
    view({ env, state, setState }) {
        return <JSExpr code={state} setCode={setState} env={env} />
    },
    getResult(state, env) {
        return computeExpr(state, env)
    },
    fromJSON(json, env) {
        if (typeof json === 'string') {
            return json
        }
        else {
            return ""
        }
    },
    toJSON(state) {
        return state
    }
})


const JSExprContainer = classed<any>('div')`flex flex-col space-y-1 flex-1`

export const JSExpr = ({ code, setCode, env }) => {
    const update = newCode => setCode(() => newCode)
    return (
        <JSExprContainer>
            <EditableCode code={code} onUpdate={update} />
            <ValueInspector value={computeExpr(code, env)} />
        </JSExprContainer>
    )
}