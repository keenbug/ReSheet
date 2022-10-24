import * as parser from '@babel/parser'
import generate from '@babel/generator'

import { computeExpr } from '../logic/compute'

export const Completions = ({ input, obj, onChoose }) => (
    <ul className="max-h-40 overflow-y-scroll">
        {typeof obj === 'object' && Object.keys(obj)
            .filter(key => match(input, key))
            .map(key => <Completion key={key} name={key} value={obj[key]} onChoose={onChoose} />)
        }
    </ul>
)

export const Completion = ({ name, value, onChoose }) => (
    <li>
        <button className="flex space-x-2 items-baseline" onClick={() => onChoose(name)}>
            <span className="font-medium">{name}</span>
            <div className="max-w-sm text-sm text-gray-700 truncate text-ellipsis">{String(value)}</div>
        </button>
    </li>
)

export const match = (input: string, key: string) => {
    if (input.length === 0) { return true }

    const currentChar = input[0]
    const restInput = input.slice(1)

    const currentCharFoundInKeyAt = key.indexOf(currentChar)
    if (currentCharFoundInKeyAt < 0) { return false }

    const restKey = key.slice(currentCharFoundInKeyAt + 1)

    return match(restInput, restKey)
}

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

export const ObjCompletions = ({ input, env, onChoose }) => {
    const { obj, accessor } =
        input.length === 0 ?
            { obj: "", accessor: "" }
        :
            getLastObj(input)

    const computedObj =
        obj === input ?
            env
        :
            computeExpr(obj, env)

    const combine = (obj, completion) => (
        input === obj ?
            completion
        :
            `${obj}.${completion}`
    )

    const onChooseCompletion = obj => completion => onChoose(combine(obj, completion))
            
    return <Completions input={obj === input ? input : accessor} obj={computedObj} onChoose={onChooseCompletion(obj)} />
}