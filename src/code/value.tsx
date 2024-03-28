import * as React from 'react'
import { Inspector } from 'react-inspector'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as solidIcons from '@fortawesome/free-solid-svg-icons'

import * as babelParser from '@babel/parser'
import babelGenerator from '@babel/generator'
import * as babelAst from '@babel/types'

import { CodeView } from '@resheet/code/editor'
import { Pending, PromiseResult, Result } from '@resheet/code/result'

import { ErrorView } from './ui'


export function ViewResult({ result }: { result: Result }) {
    switch (result.type) {
        case 'immediate':
            return <ValueInspector value={result.value} expandLevel={0} />

        case 'promise':
            return <PromiseView promiseResult={result} />
    }
}

export const ErrorInspector: React.FC<{ error: any }> = ({ error }) => {
    const [showError, setShowError] = React.useState(false)
    if (showError) {
        return (
            <ErrorBoundary
                title="There was an error displaying the error"
                viewError={error => <ErrorInspector error={error} />}>
                <Inspector table={false} data={error} />
            </ErrorBoundary>
        )
    }
    else {
        return (
            <button onClick={() => setShowError(true)}>Inspect Error</button>
        )
    }
}

export type ValueInspectorProps = {
    value: any
    expandLevel?: number
    table?: boolean
}

export const ValueInspector = React.forwardRef(
    function ValueInspector(
        props: ValueInspectorProps,
        ref: React.ForwardedRef<HTMLElement>,
    ) {
        const { value, expandLevel, table = false } = props

        if (typeof value?.then === 'function') {
            return <PromiseValueInspector ref={ref} {...props} />
        }

        if (value === Pending) {
            return <div><FontAwesomeIcon spinPulse icon={solidIcons.faSpinner} /></div>
        }

        if (React.isValidElement(value)) {
            return (
                <ErrorBoundary
                    title="There was an error in your React element"
                    viewError={error => <ErrorInspector error={error} />}
                    autoReset
                >
                    {value}
                </ErrorBoundary>
            )
        }

        if (value instanceof SyntaxError && (value as any).frame !== undefined) {
            return (
                <ErrorView title="Syntax Error in your code" error={value}>
                    <CodeView code={(value as any).frame} />
                    <ErrorInspector error={value} />
                </ErrorView>
            )
        }

        if (value instanceof Error) {
            return (
                <ErrorView title="Error in your code" error={value}>
                    <Inspector table={table} data={value} />
                </ErrorView>
            )
        }

        if (typeof value === 'function') {
            return <FunctionInspector ref={ref} func={value} />
        }

        return <Inspector table={table} data={value} expandLevel={expandLevel} />
    }
)


export const FunctionInspector = React.forwardRef(
    function FunctionInspector(
        { func }: { func: Function },
        ref: React.ForwardedRef<HTMLElement>,
    ) {
        const [isExpanded, setIsExpanded] = React.useState(false)

        let code = func.toString()

        if (code.length > 2000 || !isExpanded && !code.includes("[native code]")) {
            try {
                const ast = babelParser.parseExpression(code)

                if (babelAst.isFunctionExpression(ast)) {
                    code = (
                        babelGenerator({
                            ...ast,
                            body: {
                                ...ast.body,
                                body: [],
                            },
                        }).code
                    )
                }
                else if (babelAst.isArrowFunctionExpression(ast)) {
                    code = (
                        babelGenerator({
                            ...ast,
                            body: babelAst.identifier("..."),
                        }).code
                    )
                }
            }
            catch (e) {
                code = `function ${func.name}() {}`
            }
        }

        return (
            <CodeView
                ref={ref}
                className="cursor-pointer ml-4 text-xs"
                code={code}
                onClick={() => setIsExpanded(expanded => !expanded)}
                />
        )
    }
)


export const PromiseValueInspector = React.forwardRef(
    function PromiseValueInspector(props: ValueInspectorProps, ref: React.ForwardedRef<HTMLElement>) {
        const [promiseResult, setPromiseResult] = React.useState<PromiseResult>({ state: 'pending' })

        React.useEffect(() => {
            setPromiseResult({ state: 'pending' })
            props.value.then(
                (value: any) => { setPromiseResult({ state: 'finished', value }) },
                (error: any) => { setPromiseResult({ state: 'failed', error } ) },
            )
        }, [props.value])

        return <PromiseView ref={ref} promiseResult={promiseResult} />
    }
)

export const PromiseView = React.forwardRef(
    function PromiseView(
        { promiseResult }: { promiseResult: PromiseResult },
        ref: React.ForwardedRef<HTMLElement>,
    ) {
        return (
            <div className="group/promise-inspect flex flex-col">
                <PromiseIndicator promiseResult={promiseResult} />
                <PromiseViewValue ref={ref} promiseResult={promiseResult} />
            </div>
        )
    }
)

function PromiseIndicator({ promiseResult }: { promiseResult: PromiseResult }) {
    switch (promiseResult.state) {
        case 'pending':
            return (
                <div>
                    <FontAwesomeIcon className="mr-2" icon={solidIcons.faSpinner} spinPulse />
                    Promise pending...
                </div>
            )

        case 'failed':
            return (
                <div className="h-0 group-hover/promise-inspect:h-8 group-hover/promise-inspect:border-b-2 overflow-y-hidden transition-all text-red-900 px-1 border-t-4 border-red-100 bg-red-50">
                    <FontAwesomeIcon className="mr-2 text-red-700" icon={solidIcons.faCircleExclamation} />
                    Promise rejected
                </div>
            )

        case 'finished':
            return (
                <div className="h-0 group-hover/promise-inspect:h-8 overflow-y-hidden transition-all text-green-950 px-1 border-t-4 border-green-100 bg-green-50">
                    <FontAwesomeIcon className="mr-2 text-green-500" icon={solidIcons.faCircleCheck} />
                    Promise resolved
                </div>
            )
    }
}

const PromiseViewValue = React.forwardRef(
    function PromiseViewValue(
        { promiseResult }: { promiseResult: PromiseResult },
        ref: React.ForwardedRef<HTMLElement>,
    ) {
        switch (promiseResult.state) {
            case 'pending':
                return null

            case 'failed':
                return <div><ValueInspector ref={ref} value={promiseResult.error} /></div>

            case 'finished':
                return <div><ValueInspector ref={ref} value={promiseResult.value} /></div>
        }
    }
)



interface ErrorBoundaryProps {
    title: string
    viewError?: (caughtError: any) => JSX.Element
    children: any
    autoReset?: boolean
}

interface ErrorBoundaryState {
    caughtError: any
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props) {
        super(props)
        this.state = { caughtError: null }
    }

    static getDerivedStateFromError(error) {
        console.log("getDerivedStateFromError", error)
        return { caughtError: error }
    }

    componentDidCatch(error, errorInfo) {
        console.log("componentDidCatch", error, errorInfo)
    }

    componentDidUpdate(prevProps: Readonly<ErrorBoundaryProps>, prevState: Readonly<ErrorBoundaryState>) {
        if (this.props.autoReset && this.props !== prevProps && this.state.caughtError && prevState.caughtError) {
            this.retry()
        }
    }

    retry() {
        this.setState({ caughtError: null })
    }

    render() {
        if (this.state.caughtError) {
            return (
                <ErrorView title={this.props.title} error={this.state.caughtError}>
                    <div><button onClick={this.retry.bind(this)}>Retry</button></div>
                    {this.props.viewError &&
                        <div>{this.props.viewError(this.state.caughtError)}</div>
                    }
                </ErrorView>
            )
        }

        return this.props.children
    }
}
