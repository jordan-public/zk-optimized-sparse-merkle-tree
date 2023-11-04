import { SparseMerkleTree, Hash } from "./src"
import sha256 from "crypto-js/sha256"
import { buildPoseidon } from "circomlibjs"

async function main() {
    const depth = 8

    // Hexadecimal hashes.
    const hash = (left: Hash, right: Hash) => sha256(left as string + right as string).toString()
    const tree = new SparseMerkleTree(hash, depth)

    // Big number hashes.
    const poseidon = await buildPoseidon()
    console.log(poseidon([1n, 2n])) // 0n
    const toBigInt = (uint8Array: Uint8Array): bigint => {
        let hex = '0x';
        uint8Array.forEach(byte => {
          hex += byte.toString(16).padStart(2, '0');
        });
        return BigInt(hex);
    }  
    const hash2 = (left: Hash, right: Hash) => toBigInt(poseidon([left, right]))
    const tree2 = new SparseMerkleTree(hash2, depth, true)

    console.log(tree.root) // 0
    console.log(tree2.root) // 0n

    tree.add("2b", "44") // Hexadecimal key/value.
    tree.add("16", "78")
    tree.add("d", "e7")
    tree.add("10", "141")
    tree.add("20", "340")

    console.log(tree.root)
}

main()