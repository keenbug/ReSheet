// inspired by https://github.com/manvel-khnkoyan/jpv

import { stringify } from "."

export type ValidatorOptions = {
}

export type ValidatorFunc = (input: any, options?: ValidatorOptions) => boolean

export type ValidatorObj = { [field: string]: Validator }

export type Validator =
    | ValidatorFunc
    | ValidatorObj
    | Array<Validator>
    | RegExp
    | string
    | number
    | boolean

export function validate(validator: Validator, input: any, options: ValidatorOptions = {}): boolean {
    if (typeof validator === 'function') {
        return validator(input, options)
    }
    if (validator instanceof RegExp) {
        if (typeof input !== 'string') { return false }
        return validator.test(input)
    }
    if (Array.isArray(validator)) {
        return tuple(validator)(input, options)
    }
    if (typeof validator === 'object' && validator !== null && validator.constructor === Object) {
        return loosely(validator)(input, options)
    }
    return input === validator
}

export class ValidationError extends Error {
    validator: Validator
    input: any
    options?: ValidatorOptions

    constructor(validator: Validator, input: any, options?: ValidatorOptions) {
        super("Validation failed")

        this.validator = validator
        this.input = input
        this.options = options
    }

    toString() {
        return [
            `Validation failed`,
            `  Expected: ${stringify(this.validator)}`,
            `  Got: ${stringify(this.input)}`,
            `  Options: ${stringify(this.options)}`,
        ].join('\n')
    }
}

export function assertValid(validator: Validator, input: any, options?: ValidatorOptions) {
    if (!validate(validator, input, options)) {
        throw new ValidationError(validator, input, options)
    }
}

export function loosely(fields: ValidatorObj): ValidatorFunc {
    function validateObjectLoosely(input: any, options = {}) {
        if (typeof input !== 'object') { return false }
        if (input === null) { return false }
        if (Array.isArray(input)) { return false }
        if (input.constructor !== Object) { return false }

        for (const fieldName in fields) {
            if (!validate(fields[fieldName], input[fieldName], options)) {
                return false
            }
        }

        return true
    }
    validateObjectLoosely.toString = () => strfy`loosely(${fields})`
    return validateObjectLoosely
}

export function strict(fieldValidators: ValidatorObj): ValidatorFunc {
    function validateObjectStrictly(input: any, options = {}) {
        if (!loosely(fieldValidators)(input, options)) { return false }

        // check if both `input` and `fieldValidators` have exactly the smae fields
        const fields = Object.keys(fieldValidators)
        const inputFields = Object.keys(input)
        if (!(
            fields.length === inputFields.length
            && fields.every(field => inputFields.includes(field))
            && inputFields.every(inputField => fields.includes(inputField))
        )) {
            return false
        }

        return true
    }
    validateObjectStrictly.toString = () => strfy`strict(${fieldValidators})`
    return validateObjectStrictly
}

export function and(...validators: Validator[]): ValidatorFunc {
    function validateEvery(input: any, options = {}) {
        return validators.every(validator => validate(validator, input, options))
    }
    validateEvery.toString = () => strfy`and(${argfy(validators)})`
    return validateEvery
}

export function or(...validators: Validator[]): ValidatorFunc {
    function validateSome(input: any, options = {}) {
        return validators.some(validator => validate(validator, input, options))
    }
    validateSome.toString = () => strfy`or(${argfy(validators)})`
    return validateSome
}

export function not(validator: Validator): ValidatorFunc {
    function validateNot(input: any, options = {}) {
        return !validate(validator, input, options)
    }
    validateNot.toString = () => strfy`not(${validator})`
    return validateNot
}

export function nullable(validator: Validator): Validator {
    function validateNullable(input: any, options = {}) {
        if (input === null || typeof input === 'undefined') {
            return true
        }
        return validate(validator, input, options)
    }
    validateNullable.toString = () => strfy`nullable(${validator})`
    return validateNullable
}

export function oneOf(...validators: Validator[]): ValidatorFunc {
    function validateOneOf(input: any, options = {}) {
        return validators.some(validator => validate(validator, input, options))
    }
    validateOneOf.toString = () => strfy`oneOf(${argfy(validators)})`
    return validateOneOf
}

export function array(validator: Validator): ValidatorFunc {
    function validateArray(input: any, options = {}) {
        if (!Array.isArray(input)) { return false }
        return input.every(item => validate(validator, item, options))
    }
    validateArray.toString = () => strfy`array(${validator})`
    return validateArray
}

export function tuple(validators: Validator[]): ValidatorFunc {
    function validateTuple(input: any, options = {}) {
        if (!Array.isArray(input)) { return false }
        if (validators.length !== input.length) { return false }
        for (let index = 0; index < validators.length; index++) {
            if (!validate(validators[index], input[index], options)) {
                return false
            }
        }
        return true
    }
    validateTuple.toString = () => strfy`${validators}`
    return validateTuple
}

export function lazy<Args extends any[]>(validatorCreator: (...args: Args) => Validator, ...args: Args): ValidatorFunc {
    function lazyValidator(input: any, options = {}) {
        return validate(validatorCreator(...args), input, options)
    }
    lazyValidator.toString = () => strfy`lazy(${validatorCreator}, ${argfy(args)})`
    return lazyValidator
}

export function is(value: any): ValidatorFunc {
    function isValue(input: any, options = {}) {
        return input === value
    }
    isValue.toString = () => strfy`is(${value})`
    return isValue
}

export function typeis(typeName: string): ValidatorFunc {
    function validateTypeof(input: any, options = {}) {
        return typeof input === typeName
    }
    validateTypeof.toString = () => typeName
    return validateTypeof
}

export function any(input: any, options = {}) {
    return true
}
any.toString = () => 'any'

export function defined(input: any, options = {}) {
    return typeof input !== 'undefined'
}
defined.toString = () => 'defined'

export const string = typeis('string')
export const number = typeis('number')
export const boolean = typeis('boolean')


export function validatorSwitch<T>(input: any, ...cases: Array<[validator: Validator, handler: (input: any) => T]>): T {
    for (const [validator, handler] of cases) {
        if (validate(validator, input)) {
            return handler(input)
        }
    }
}


function strfy(strs: TemplateStringsArray, ...interpolations: any[]) {
    return (
        strs[0]
        + strs.slice(1)
            .map((str, idx) => (
                (
                    idx < interpolations.length ?
                        stringify(interpolations[idx])
                    :
                        ''
                )
                + str
            ))
            .join('')
    )
}

function argfy(args: any[]) {
    return { toString() { return args.map(stringify).join(', ') } }
}
