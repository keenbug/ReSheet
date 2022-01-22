import React from 'react'

import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'

import { classed } from './ui'


/**************** Code Editor *****************/

const CodeContent = classed('code')`
    block
    rounded
    hover:bg-gray-100 focus:bg-gray-100
    break-word
`


export const EditableCode = ({ code, onUpdate, highlight, className, ...props }) => {
    const [isEditing, setEditing] = React.useState(false)

    const stopEditing = () => { setEditing(false) }
    const startEditing = () => { setEditing(true) }

    if (isEditing) {
        return <CodeEditor code={code} onUpdate={onUpdate} highlight={highlight} onBlur={stopEditing} className={className} {...props} />
    }
    else {
        return <CodeView code={code} onClick={startEditing} highlight={highlight} className={'cursor-text ' + className} {...props} />
    }
}


export const CodeView = ({ code, highlight = highlightJS, ...props }) => {
    const ref = React.useRef(null)

    React.useEffect(() => {
        if (ref.current) {
            ref.current.textContent = code
            highlight(ref.current)
        }
    }, [code, ref.current])

    return <pre><CodeContent ref={ref} style={{ minHeight: "1.5rem" }} {...props} /></pre>
}


export const CodeEditor = ({ code, onUpdate, highlight = highlightJS, ...props }) => {
    const ref = useCodeJar({
        code,
        onUpdate,
        highlight,
        options: {
            tab: "  ",
        },
    })

    return <pre><CodeContent ref={ref} {...props} /></pre>
}

export const highlightJS = editor => {
    const text = editor.textContent
    editor.innerHTML = Prism.highlight(
        text,
        Prism.languages.javascript,
        'javascript'
    )
}
