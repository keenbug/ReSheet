import { Result } from "../../logic/result"
import { addRevision, addValidator } from "../../utils/serialize"
import { string } from "../../utils/validate"


function typed<Obj extends object>(revision: number, obj: Obj): Obj {
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
    schema: typed(0, { code: string }),
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

export { v0 as fromJSON }

export function toJSON(state: JSExprModelV0) {
    return typed(0, {
        code: state.code,
    })
}
