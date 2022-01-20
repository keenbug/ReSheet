import React from 'react'

import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'

import { classed } from './ui'


/**************** Code Editor *****************/

const CodeContent = classed('code')`
    block
    rounded
    hover:bg-gray-100 focus:bg-gray-100
`


export const EditableCode = ({ code, onUpdate, ...props }) => {
    const [isEditing, setEditing] = React.useState(false)

    const stopEditing = () => { setEditing(false) }
    const startEditing = () => { setEditing(true) }

    if (isEditing) {
        return <CodeEditor code={code} onUpdate={onUpdate} onBlur={stopEditing} {...props} />
    }
    else {
        return <CodeView code={code} onClick={startEditing} {...props} />
    }
}


export const CodeView = ({ code, ...props }) => {
    const ref = React.useRef(null)

    React.useEffect(() => {
        if (ref.current) {
            ref.current.innerHTML = Prism.highlight(
                code,
                Prism.languages.javascript,
                'javascript',
            )
        }
    }, [code, ref.current])

    return <pre><CodeContent ref={ref} style={{ minHeight: "1.5rem" }} {...props} /></pre>
}


export const CodeEditor = ({ code, onUpdate, ...props }) => {
    const ref = useCodeJar({
        code,
        onUpdate,
        highlight: highlightJS,
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
