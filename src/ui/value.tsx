import * as React from 'react'
import Inspector from 'react-inspector'
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

export const ValueInspector: React.FC<{ value: any }> = ({ value }) => {
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
    if (value instanceof Error) {
        return (
            <div>
                <h1>{value.name}</h1>
                <p>{value.message}</p>
                <Inspector data={value} />
            </div>
        )
    }
    return <div><Inspector data={value} expandLevel={1} /></div>
}


interface ErrorBoundaryProps {
    title: string
    viewError?: (caughtError: any) => JSX.Element
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
