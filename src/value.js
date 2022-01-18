import React from 'react'
import Inspector from 'react-inspector'

import { catchAll } from './utils'


const appTypeSymbol = Symbol('appType')
export const initialAppState = Symbol('initialAppState')

export const createApp = (callback, initialData=initialAppState) => ({
    $$type: appTypeSymbol,
    initialData,
    callback,
})
export const isApp = value => value?.$$type === appTypeSymbol
export const runApp = (state, setState, app) => {
    const data = state === initialAppState ? app.initialData : state
    const setData = update => (
        typeof update === 'function' ?
            setState(state =>
                update(
                    state === initialAppState ?
                        app.initialData
                    :
                        state
                )
            )
        :
            setState(update)
    )
    return React.createElement(app.callback, { data, setData })
}



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
    return <div><Inspector data={value} /></div>
}


export const ValueViewer = ({ value, state, setState }) => {
    if (isApp(value)) {
        return (
            <ErrorBoundary
                title="There was an error in your App"
                viewError={error => <ErrorInspector error={error} />}
            >
                {catchAll(
                    () => React.createElement(() => runApp(state, setState, value)),
                    error => <ValueInspector value={error} />
                )}
            </ErrorBoundary>
        )
    }
    return <ValueInspector value={value} />
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