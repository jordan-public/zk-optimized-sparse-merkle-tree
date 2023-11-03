/**
 * Converts a hexadecimal number to a binary number.
 * @param n A hexadecimal number.
 * @returns The relative binary number.
 */
export function hexToBin(n: string): string {
    let bin = Number(`0x${n[0]}`).toString(2)

    for (let i = 1; i < n.length; i += 1) {
        bin += Number(`0x${n[i]}`).toString(2).padStart(4, "0")
    }

    return bin
}

/**
 * Checks if a number is a hexadecimal number.
 * @param n A hexadecimal number.
 * @returns True if the number is a hexadecimal, false otherwise.
 */
export function checkHex(n: string): boolean {
    return typeof n === "string" && /^[0-9A-Fa-f]{1,64}$/.test(n)
}