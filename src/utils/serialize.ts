import { Validator, assertValid } from "./validate"
import { stringify } from "."

export type Parser<Result> = (input: any) => Result

export function addValidator<Result>(schema: Validator, parseValidated: Parser<Result>) {
    function withValidator(input: any) {
        assertValid(schema, input)
        return parseValidated(input)
    }
    withValidator.toString = () => `addValidator(${stringify(schema)}, ${parseValidated})`
    return withValidator
}

export type Revision<CurrentRevision, RevisionBefore> = {
    schema: Validator
    parse(input: any): CurrentRevision
    upgrade(before: RevisionBefore): CurrentRevision
}

export function addRevision<NewRevision, OldRevision>(before: Parser<OldRevision>, revision: Revision<NewRevision, OldRevision>) {
    function deserializeRevision(input: any) {
        try {
            assertValid(revision.schema, input)
            return revision.parse(input)
        }
        catch (currentError) {
            try {
                return revision.upgrade(before(input))
            }
            catch (beforeError) {
                throw new Error([
                    `Could not deserialize revision`,
                    `  ${stringify(revision.schema)}`,
                    indent('  ', currentError.toString()),
                    beforeError.toString(),
                ].join('\n'))
            }
        }
    }
    deserializeRevision.toString = () => `addRevision(${before}, ${stringify(revision)})`
    return deserializeRevision
}

function indent(indentation: string, str: string) {
    return str.split('\n').map(line => indentation + line).join('\n')
}
