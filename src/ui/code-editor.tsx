import * as React from 'react'

import { useCodeJar } from 'react-codejar'
import Prism from 'prismjs'

import { classed } from './utils'


/**************** Code Editor *****************/

const CodeContent = classed<any>('code')`
    block
    rounded
    hover:bg-gray-100 focus:bg-gray-100
    break-word
`


export const EditableCode: React.FC<any> = ({ code, onUpdate, highlight, className, ...props }) => {
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


export const CodeView: React.FC<any> = ({ code, highlight = highlightJS, ...props }) => {
    const ref = React.useRef(null)

    return (
        <pre>
            <CodeContent
                ref={ref}
                style={{ minHeight: "1.5rem" }}
                dangerouslySetInnerHTML={{ __html: highlight(code) }}
                {...props}
            />
        </pre>
    )
}


export const CodeEditor: React.FC<any> = ({ code, onUpdate, highlight = highlightJS, ...props }) => {
    const highlightCodeJar = editor => {
        editor.innerHTML = highlight(editor.textContent)
    }
    const ref = useCodeJar({
        code,
        onUpdate,
        highlight: highlightCodeJar,
        style: {},
        options: {
            tab: "  ",
        },
    })

    return <pre><CodeContent ref={ref} {...props} /></pre>
}

export const highlightNothing = code => new Option(code).innerHTML

export const highlightJS = code => (
    Prism.highlight(
        code,
        Prism.languages.javascript,
        'javascript'
    )
)
