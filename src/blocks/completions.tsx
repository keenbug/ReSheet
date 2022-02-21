import * as parser from '@babel/parser'
import generate from '@babel/generator'

import { computeExpr } from '../logic/compute'

export const Completions = ({ input, obj }) => (
    <ul>
        {typeof obj === 'object' && Object.keys(obj)
            .filter(k => k.startsWith(input))
            .map(k => <li>{k} {String(obj[k])}</li>)
        }
    </ul>
)

export const getLastObj = input => {
    if (input[input.length - 1] === '.') {
        return { obj: input.slice(0, -1), accessor: "" }
    }
    else {
        try {
            const parsed = parser.parseExpression(input)
            if (parsed.type === 'MemberExpression') {
                return {
                    obj: generate(parsed.object).code,
                    accessor: generate(parsed.property).code,
                }
            }
        }
        catch (e) {}
        return { obj: input, accessor: "" }
    }
}

export const ObjCompletions = ({ input, env }) => {
    const { obj, accessor } =
        input.length === 0 ?
            { obj: "", accessor: "" }
        :
            getLastObj(input)
        
    const computedObj =
        obj.length === 0 ?
            env
        :
            computeExpr(obj, env)
            
    return <Completions input={accessor} obj={computedObj} />
}