import React from 'react'
import Inspector, { ObjectRootLabel, ObjectLabel } from 'react-inspector'


/**************** Value Viewer *****************/

export const ErrorInspector = ({ error }) => {
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

export const inspectorNodeRenderer = ({ expanded, depth, ...props }) => (
    expanded && depth > 0 ?
        <ObjectLabel {...props} />
    :
        <ObjectRootLabel {...props} />
)

export const ValueInspector = ({ value }) => {
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
    return <div><Inspector data={value} expandLevel={1} nodeRenderer={inspectorNodeRenderer} /></div>
}


export class ErrorBoundary extends React.Component {
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
                <div>
                    <h3>{this.props.title}</h3>
                    <h4>{this.state.caughtError.name}</h4>
                    <p>{this.state.caughtError.message}</p>
                    <div><button onClick={this.retry.bind(this)}>Retry</button></div>
                    {this.props.viewError &&
                        <div>{this.props.viewError(this.state.caughtError)}</div>
                    }
                </div>
            )
        }

        return this.props.children
    }
}