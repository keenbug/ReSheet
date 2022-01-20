import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styled, { css } from 'styled-components'

import { interpolate } from './utils'



export const onMetaEnter = func => event => {
    if (event.key === 'Enter' && event.metaKey) {
        event.preventDefault()
        func(event)
    }
}



export const classes = classDict =>
    Object.keys(classDict).reduce(
        (classStr, className) =>
            classDict[className] ?
                className + ' ' + classStr
            :
                classStr
        ,
        ""
    )

export const classed = elem => (strings, ...interpolations) =>
    React.forwardRef((props, ref) =>
        React.createElement(
            elem,
            {
                ...props,
                ref,
                className: `${interpolate(strings, interpolations, props)} ${props.className ?? ""}`,
            }
        )
    )




const TextInputHTML = styled.span`
    ${({ placeholder }) =>
        placeholder ?
            css`
                &:empty:after {
                    content: "${placeholder}";
                    color: #aaa;
                }
            `
        :
            ''
    }
`

const space = String.fromCharCode(32)
const fixedWidth = String.fromCharCode(160)
const spaceToFixedWidth = str => str.replaceAll(space, fixedWidth)
const fixedWidthToSpace = str => str.replaceAll(fixedWidth, space)

export const TextInput = ({ value, onUpdate, ...props }) => {
    const ref = React.useRef(null)
    React.useLayoutEffect(() => {
        if (spaceToFixedWidth(ref.current.innerText) !== spaceToFixedWidth(value)) {
            ref.current.innerText = spaceToFixedWidth(value)
        }
    })
    const onInput = event => {
        const { innerText, innerHTML } = event.target
        const text = spaceToFixedWidth(innerText.replaceAll('\n', ''))
        const html = spaceToFixedWidth(innerHTML.replaceAll("&nbsp;", fixedWidth))
        if (html !== text) {
            event.target.innerHTML = text
        }
        onUpdate(fixedWidthToSpace(text))
    }
    return <TextInputHTML contentEditable="plaintext-only" ref={ref} onInput={onInput} {...props} />
}




export const ToggleButton = classed('button')`
    text-left
    text-slate-600

    hover:bg-gray-200 hover:text-slate-600
    focus:bg-gray-300 focus:text-slate-700

    transition-colors

    outline-none
    h-7 px-1 space-x-1
`

export const IconToggleButton = ({ className, isActive, icon, iconDisabled, onUpdate, label="", ...props }) => (
    <ToggleButton
        className={(className ?? "") + (isActive ? "" : " text-slate-400")}
        onClick={onUpdate}
        {...props}
    >
        <div className="inline-block w-5 text-center">
            <FontAwesomeIcon size="xs" icon={isActive ? icon : (iconDisabled || icon)} />
        </div>
        {label && <span>{label}</span>}
    </ToggleButton>
)
