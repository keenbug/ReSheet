import React from 'react'
import styled, { css } from 'styled-components'

export const nextElem = (elem, allElems) => {
    const elemIdx = allElems.findIndex(e => e === elem)
    const nextElemIdx = (elemIdx + 1) % allElems.length
    return allElems[nextElemIdx]
}


export const onMetaEnter = func => event => {
    if (event.key === 'Enter' && event.metaKey) {
        event.preventDefault()
        func(event)
    }
}

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

export const TextInput = ({ value, onUpdate, ...props }) => {
    const ref = React.useRef(null)
    React.useLayoutEffect(() => {
        if (ref.current.innerText !== value) {
            ref.current.innerText = value
        }
    })
    const onInput = event => {
        const { innerText, innerHTML } = event.target
        const text = String(innerText)
        const html = String(innerHTML).replaceAll("&nbsp;", " ")
        if (html !== text) {
            event.target.innerHTML = innerText
        }
        onUpdate(text)
    }
    return <TextInputHTML contentEditable ref={ref} onInput={onInput} {...props} />
}



export const interpolate = (strings, interpolations, props) => {
    const computedInterpolations = interpolations.map(interpolation => {
        if (typeof interpolation === 'function') {
            return String(interpolation(props))
        }
        else {
            return String(interpolation)
        }
    })

    return strings.reduce(
        (prev, string, idx) =>
            prev.concat(string, computedInterpolations[idx] ?? ""),
        "",
    )
}

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

export const updateArray = (updateIdx, newValue, array) =>
    array.map((value, idx) => idx === updateIdx ? newValue : value)

export const subUpdateArray = (idx, update) => newValue => {
    if (typeof newValue === 'function') {
        update(bigValue => updateArray(idx, newValue(bigValue[idx]), bigValue))
    }
    else {
        update(bigValue => updateArray(idx, newValue, bigValue))
    }
}

export const subUpdate = (fieldName, update) => newValue => {
    if (typeof newValue === 'function') {
        update(bigValue => ({
            ...bigValue,
            [fieldName]: newValue(bigValue[fieldName]),
        }))
    }
    else {
        update(bigValue => ({
            ...bigValue,
            [fieldName]: newValue,
        }))
    }
}

export const logUpdate = update => newValue => {
    if (typeof newValue === 'function') {
        update(oldValue => {
            const updatedValue = newValue(oldValue)
            console.log('functional update', oldValue, newValue)
            return updatedValue
        })
    }
    else {
        console.log('constant update', newValue)
        update(newValue)
    }
}
