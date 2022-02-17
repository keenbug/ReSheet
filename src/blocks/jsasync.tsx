import * as React from 'react'

import { JSComputation, JSComputationJSON, fcoBlockAdapter } from '../logic/components'
import { ErrorInspector, ValueInspector } from '../ui/value'
import { EditableCode } from '../ui/code-editor'
import { classed } from '../ui/utils'
import { FCO } from '../logic/fc-object'
import { computeExpr } from '../logic/compute'


/**************** Code Actions **************/

export const setCodeExpr = (expr, block) =>
    block.update({ expr })

export const JSAsyncBlockFCO = FCO
    .combine(JSComputation)
    .combine(JSComputationJSON)
    .addMethods({
        view({ block, setBlock, env }) {
            const dispatch = (action, ...args) => {
                setBlock(block => action(...args, block))
            }
            return <JSAsync block={block} dispatch={dispatch} env={env} />
        },
    })

export const JSAsyncBlock = fcoBlockAdapter(JSAsyncBlockFCO)



/**************** UI *****************/

const JSAsyncContainer = classed<any>('div')`flex flex-col space-y-1 flex-1`

type ResultState =
    | { state: 'loading' }
    | { state: 'loaded', result: any }
    | { state: 'failed', error: any }

export const JSAsync = ({ block: code, dispatch, env }) => {
    const onUpdateExpr = expr => dispatch(setCodeExpr, expr)

    const [result, setResult] = React.useState<ResultState>({ state: 'loading' })
    React.useEffect(() => {
        setResult({ state: 'loading' })
        const res = null //computeExpr(code.expr, env)
        if (typeof res?.then === 'function' && typeof res?.catch === 'function') {
            res
                .then(result => setResult({ state: 'loaded', result }))
                .catch(error => setResult({ state: 'failed', error }))
        }
        else {
            setResult({ state: 'loaded', result: res })
        }
    }, [code.expr, env])

    return (
        <JSAsyncContainer key={code.id}>
            <EditableCode code={code.expr} onUpdate={onUpdateExpr} />
            <ResultStateInspector result={result} />
        </JSAsyncContainer>
    )
}

export const ResultStateInspector: React.FC<{result: ResultState}> = ({ result }) => {
    switch (result.state) {
        case 'failed':
            return <div>failed: <ValueInspector value={result.error} /></div>
        case 'loaded':
            return <ValueInspector value={result.result} />
        case 'loading':
            return <span>loading</span>
    }
}