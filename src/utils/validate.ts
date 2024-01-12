// inspired by https://github.com/manvel-khnkoyan/jpv

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
}

export function assertValid(validator: Validator, input: any, options?: ValidatorOptions) {
    if (!validate(validator, input, options)) {
        throw new ValidationError(validator, input, options)
    }
}

export function loosely(fields: { [field: string]: Validator }): ValidatorFunc {
    return function validateObject(input: any, options = {}) {
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
}

export function strict(fieldValidators: { [field: string]: Validator }): ValidatorFunc {
    return function validateObjectStrictly(input: any, options = {}) {
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
}

export function and(...validators: Validator[]): ValidatorFunc {
    return function validateEvery(input: any, options = {}) {
        return validators.every(validator => validate(validator, input, options))
    }
}

export function or(...validators: Validator[]): ValidatorFunc {
    return function validateSome(input: any, options = {}) {
        return validators.some(validator => validate(validator, input, options))
    }
}

export function not(validator: Validator): ValidatorFunc {
    return function validateNot(input: any, options = {}) {
        return !validate(validator, input, options)
    }
}

export function nullable(validator: Validator): Validator {
    return function validateNullable(input: any, options = {}) {
        if (input === null || typeof input === 'undefined') {
            return true
        }
        return validate(validator, input, options)
    }
}

export function forEach(validator: Validator): ValidatorFunc {
    return function validateForEach(input: any, options = {}) {
        if (!Array.isArray(input)) { return false }
        return input.every(item => validate(validator, item, options))
    }
}

export function tuple(validators: Validator[]): ValidatorFunc {
    return function validateTuple(input: any, options = {}) {
        if (!Array.isArray(input)) { return false }
        if (validators.length !== input.length) { return false }
        for (let index = 0; index < validators.length; index++) {
            if (!validate(validators[index], input[index], options)) {
                return false
            }
        }
        return true
    }
}

export function typeis(typeName: string): ValidatorFunc {
    return function validateTypeof(input: any, options = {}) {
        return typeof input === typeName
    }
}

export function any(input: any, options = {}) {
    return true
}

export function defined(input: any, options = {}) {
    return typeof input !== 'undefined'
}

export const string = typeis('string')
export const number = typeis('number')
export const boolean = typeis('boolean')