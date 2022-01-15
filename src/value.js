import React from 'react'
import Inspector from 'react-inspector'

import { catchAll } from './utils'


const stateful = Symbol('stateful')
export const Stateful = callback => ({
    $$type: stateful,
    callback,
})
export const isStateful = value => value?.$$type === stateful


/**************** Value Viewer *****************/

export const ValueInspector = ({ value }) => {
    if (React.isValidElement(value)) {
        return <ErrorBoundary>{value}</ErrorBoundary>
    }
    if (value instanceof Error) {
        return (
            <div>
                <h1>{value.name}</h1>
                <pre className="overflow-x-scroll">{value.message}</pre>
                <Inspector data={value} />
            </div>
        )
    }
    return <div><Inspector data={value} /></div>
}


export const ValueViewer = ({ value, state, onUpdate }) => {
    if (isStateful(value)) {
        return <ValueInspector value={catchAll(() => value.callback({ state, onUpdate }))} />
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
                    <pre className="overflow-x-scroll">{this.state.caughtError.message}</pre>
                    <button onClick={this.retry.bind(this)}>Retry</button>
                </div>
            )
        }

        return this.props.children
    }
}
