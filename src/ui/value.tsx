import * as React from 'react'
import { Inspector } from 'react-inspector'
import { CodeView } from './code-editor'
import { ErrorView } from './utils'


/**************** Value Viewer *****************/

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

export function ValueInspector(props: ValueInspectorProps) {
    const { value, expandLevel, table = false } = props
    if (typeof value?.then === 'function') {
        return <PromiseValueInspector {...props} />
    }
    if (React.isValidElement(value)) {
        return (
            <ErrorBoundary
                title="There was an error in your React element"
                viewError={error => <ErrorInspector error={error} />}
            >
                {React.createElement(() => value)}
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
        return <CodeView className="ml-4 text-xs" code={value.toString()} />
    }

    return <Inspector table={table} data={value} expandLevel={expandLevel} />
}

export type PromiseState =
    | { state: 'pending' }
    | { state: 'fulfilled', value: any }
    | { state: 'rejected', error: any }

export function PromiseValueInspector(props: ValueInspectorProps) {
    const [promiseState, setPromiseState] = React.useState<PromiseState>({ state: 'pending' })

    React.useEffect(() => {
        props.value.then(
            (value: any) => { setPromiseState({ state: 'fulfilled', value }) },
            (error: any) => { setPromiseState({ state: 'rejected', error } ) },
        )
    }, [props.value])

    switch (promiseState.state) {
        case 'pending':
            return <>Promise pending...</>
        case 'fulfilled':
            return <ValueInspector {...props} value={promiseState.value} />
        case 'rejected':
            return <>Promise rejected: <ValueInspector {...props} value={promiseState.error} /></>
    }
}


interface ErrorBoundaryProps {
    title: string
    viewError?: (caughtError: any) => JSX.Element
    children: any
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
