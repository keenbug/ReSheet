import { addRevision, addValidator } from "@resheet/util/serialize"
import { string } from "@resheet/util/validate"
import { Result } from "@resheet/code/result"


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
}

const vPre = addValidator<JSExprModelV0>(
    string,
    code => ({
        code,
        result: { type: 'immediate', value: undefined },
    }),
)

const v0 = addRevision(vPre, {
    schema: typedTables(0, { code: string }),
    parse({ code }): JSExprModelV0 {
        return {
            code,
            result: { type: 'immediate', value: undefined },
        }
    },
    upgrade(before) {
        return before
    },
})

const v1 = addRevision(v0, {
    schema: typed(1, { code: string }),
    parse({ code }): JSExprModelV0 {
        return {
            code,
            result: { type: 'immediate', value: undefined },
        }
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
}

export { v1 as fromJSON }

export function toJSON(state: JSExprModelV0) {
    return typed(1, {
        code: state.code,
    })
}
