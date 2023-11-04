import { SparseMerkleTree, Hash } from "./src"
import * as sha256 from "crypto-js/sha256"
import { buildPoseidon } from "circomlibjs"

// Hexadecimal hashes.
const hash = (left: Hash, right: Hash) => sha256(left as string + right as string).toString()
const tree = new SparseMerkleTree(hash, 3)

// Big number hashes.
const poseidon = await buildPoseidon()
console.log(poseidon([1n, 2n])) // 0n
const hash2 = (left: Hash, right: Hash) => poseidon([left, right])
const tree2 = new SparseMerkleTree(hash2, 3, true)

console.log(tree.root) // 0
console.log(tree2.root) // 0n
