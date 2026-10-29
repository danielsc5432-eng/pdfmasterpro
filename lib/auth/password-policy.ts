// Whitespace and accented letters are not special characters.
export const hasSpecialCharacter = (password: string) => /[\p{P}\p{S}]/u.test(password);
export const PASSWORD_SPECIAL_MESSAGE = "Inclua pelo menos 1 caractere especial, como !, @, # ou $.";
