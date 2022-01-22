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


export const EditableCode = ({ code, onUpdate, highlight, ...props }) => {
    const [isEditing, setEditing] = React.useState(false)

    const stopEditing = () => { setEditing(false) }
    const startEditing = () => { setEditing(true) }

    if (isEditing) {
        return <CodeEditor code={code} onUpdate={onUpdate} highlight={highlight} onBlur={stopEditing} {...props} />
    }
    else {
        return <CodeView code={code} onClick={startEditing} highlight={highlight} {...props} />
    }
}


export const CodeView = ({ code, highlight = highlightJS, ...props }) => {
    const ref = React.useRef(null)

    React.useEffect(() => {
        if (ref.current) {
            highlight(ref.current, code)
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

export const highlightJS = (editor, code) => {
    const text = code || editor.textContent
    editor.innerHTML = Prism.highlight(
        text,
        Prism.languages.javascript,
        'javascript'
    )
}
