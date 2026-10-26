/**
 * A text in a message file: plain, or one per plural form, chosen by the
 * `count` it is given (Intl.PluralRules: English needs `one` and `other`,
 * Russian also `few` and `many`, Arabic all six).
 */
export interface PluralForms {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralForms;

/**
 * Another language's version of one of the English message files: the same
 * keys, every one of them, and a plural wherever English has one.
 */
export type Translation<T> = { readonly [K in keyof T]: T[K] extends string ? string : PluralForms };
