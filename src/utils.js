export const catchAll = (fn, onError = e => e) => {
    try {
        return fn()
    }
    catch (e) {
        return onError(e)
    }
}

export const nextElem = (elem, allElems) => {
    const elemIdx = allElems.findIndex(e => e === elem)
    const nextElemIdx = (elemIdx + 1) % allElems.length
    return allElems[nextElemIdx]
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

export const runUpdate = (update, oldValue) =>
    typeof update === 'function' ? update(oldValue) : update

export const updateArray = (updateIdx, newValue, array) =>
    array.map((value, idx) => idx === updateIdx ? newValue : value)

export const subUpdateArray = (idx, update) => newValue => {
    update(bigValue => updateArray(idx, runUpdate(newValue, bigValue[idx]), bigValue))
}

export const subUpdate = (fieldName, update) => newValue => {
    update(bigValue => ({
        ...bigValue,
        [fieldName]: runUpdate(newValue, bigValue[fieldName]),
    }))
}

export const logUpdate = (msg = '', update) => newValue => {
    update(oldValue => {
        const updatedValue = runUpdate(newValue, oldValue)
        console.log(`update ${msg}`, oldValue, updatedValue)
        return updatedValue
    })
}

export const logV = (msg = '', value) => {
    console.log(msg, value)
    return value
}
