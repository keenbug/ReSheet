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
    return app.callback({ data, setData })
}



/**************** Value Viewer *****************/

export const ValueInspector = ({ value }) => {
    if (React.isValidElement(value)) {
        return <ErrorBoundary>{value}</ErrorBoundary>
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


export const AppView = ({ app, state, setState }) => {
    const App = () => runApp(state, setState, app)
    return <ErrorBoundary><App /></ErrorBoundary>
}


export const ValueViewer = ({ value, state, setState }) => {
    if (isApp(value)) {
        return catchAll(
            () => <AppView app={value} state={state} setState={setState} />,
            error => <ValueInspector value={error} />,
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
                    <h3>An error occurred in your component</h3>
                    <h4>{this.state.caughtError.name}</h4>
                    <p>{this.state.caughtError.message}</p>
                    <button onClick={this.retry.bind(this)}>Retry</button>
                </div>
            )
        }

        return this.props.children
    }
}