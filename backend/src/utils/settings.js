function positiveInteger(name, fallback, maximum) {
    const value = process.env[name];
    if (value === undefined || value === "") return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1 || number > maximum) {
        throw new Error(`${name} must be an integer between 1 and ${maximum}`);
    }
    return number;
}
module.exports = { positiveInteger };
