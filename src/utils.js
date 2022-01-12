import React from 'react'

export const nextElem = (elem, allElems) => {
    const elemIdx = allElems.findIndex(e => e === elem)
    const nextElemIdx = (elemIdx + 1) % allElems.length
    return allElems[nextElemIdx]
}


export const onMetaEnter = func => event => {
    if (event.key === 'Enter' && event.metaKey) {
        event.preventDefault()
        func()
    }
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
                className: `${props.className ?? ""} ${interpolate(strings, interpolations, props)}`,
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
