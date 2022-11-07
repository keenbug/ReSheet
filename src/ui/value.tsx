import * as React from 'react'
import Inspector, { InspectorProps } from 'react-inspector'
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
                <Inspector data={error} />
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
}

export function ValueInspector(props: ValueInspectorProps) {
    const { value, expandLevel } = props
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
                <Inspector data={value} />
            </ErrorView>
        )
    }

    return <div><Inspector data={value} expandLevel={expandLevel} /></div>
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
