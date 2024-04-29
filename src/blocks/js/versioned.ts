import { addRevision, addValidator } from "@resheet/util/serialize"
import { string } from "@resheet/util/validate"
import { Result } from "@resheet/code/result"

import { Compiled, Environment, compileScriptSafe, emptyCompiled } from '@resheet/code/compute'


function typed<Obj extends object>(revision: number, obj: Obj): Obj {
    return {
        t: 'resheet.jsexpr',
        v: revision,
        ...obj,
    }
}

function typedTables<Obj extends object>(revision: number, obj: Obj): Obj {
    return {
        t: 'tables.jsexpr',
        v: revision,
        ...obj,
    }
}

// Revisions

interface JSExprModelV0 {
    code: string
    result: Result
    compiled: Compiled
}

type ParseV0 = (env: Environment) => JSExprModelV0

const vPre = addValidator<ParseV0>(
    string,
    code => env => ({
        code,
        result: { type: 'immediate', value: undefined },
        compiled: compileScriptSafe(code),
    }),
)

const v0 = addRevision<ParseV0, ParseV0>(vPre, {
    schema: typedTables(0, { code: string }),
    parse({ code }) {
        return env => ({
            code,
            result: { type: 'immediate', value: undefined },
            compiled: compileScriptSafe(code),
        })
    },
    upgrade(before) {
        return before
    },
})

const v1 = addRevision<ParseV0, ParseV0>(v0, {
    schema: typed(1, { code: string }),
    parse({ code }) {
        return env => ({
            code,
            result: { type: 'immediate', value: undefined },
            compiled: compileScriptSafe(code),
        })
    },
    upgrade(before) {
        return before
    },
})


// Export current Revision

export type {
    JSExprModelV0 as JSExprModel
}

export const init: JSExprModelV0 = {
    code: '',
    result: { type: 'immediate', value: undefined },
    compiled: emptyCompiled,
}

export { v1 as fromJSON }

export function toJSON(state: JSExprModelV0) {
    return typed(1, {
        code: state.code,
    })
}
