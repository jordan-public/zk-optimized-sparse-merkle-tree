"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("./src");
const sha256_1 = __importDefault(require("crypto-js/sha256"));
const circomlibjs_1 = require("circomlibjs");
async function main() {
    // Hexadecimal hashes.
    const hash = (left, right) => (0, sha256_1.default)(left + right).toString();
    const tree = new src_1.SparseMerkleTree(hash, 3);
    // Big number hashes.
    const poseidon = await (0, circomlibjs_1.buildPoseidon)();
    console.log(poseidon([1n, 2n])); // 0n
    const toBigInt = (uint8Array) => {
        let hex = '0x';
        uint8Array.forEach(byte => {
            hex += byte.toString(16).padStart(2, '0');
        });
        return BigInt(hex);
    };
    const hash2 = (left, right) => toBigInt(poseidon([left, right]));
    const tree2 = new src_1.SparseMerkleTree(hash2, 3, true);
    console.log(tree.root); // 0
    console.log(tree2.root); // 0n
}
main();
