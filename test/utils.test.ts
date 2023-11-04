import { hexToBin, checkHex } from "../src/utils"

describe("Utility functions", () => {
    describe("Convert SMT keys in 256-bit paths", () => {
        it("Should convert a key in an array of 256 bits", () => {
            const path = keyToPath("17")

            expect(path).toHaveLength(256)
            expect(path.every((b) => b === 0 || b === 1)).toBeTruthy()
        })

        it("Should create a path in the correct order", () => {
            const path = keyToPath("17")

            expect(path.slice(0, 5)).toEqual([1, 1, 1, 0, 1])
        })
    })

    describe("Check hexadecimal", () => {
        it("Should return true if the number is a hexadecimal", () => {
            expect(checkHex("be12")).toBeTruthy()
        })

        it("Should return false if the number is not a hexadecimal", () => {
            expect(checkHex("gbe12")).toBeFalsy()
        })
    })

    describe("Convert hexadecimal to binary", () => {
        it("Should convert a hexadecimal number to a binary number", () => {
            expect(hexToBin("12")).toBe("10010")
        })
    })
})