import { SparseMerkleTree, Hash } from "./src"
import sha256 from "crypto-js/sha256"
import { buildPoseidon } from "circomlibjs"

async function main() {
    const depth = 3

    // Hexadecimal hashes.
    const hash = (left: Hash, right: Hash) => sha256(left as string + right as string).toString()
    const tree = new SparseMerkleTree(hash, depth)

    // Big number hashes.
    const poseidon = await buildPoseidon()
    const toBigInt = (uint8Array: Uint8Array): bigint => {
        let hex = '0x';
        uint8Array.forEach(byte => {
          hex += byte.toString(16).padStart(2, '0');
        });
        return BigInt(hex);
    }  
    console.log(poseidon([1n, 2n])) // 0n
    console.log(toBigInt(poseidon([1n, 2n]))) // 0n
    const hash2 = (left: Hash, right: Hash) => toBigInt(poseidon([left, right]))
    const tree2 = new SparseMerkleTree(hash2, depth, true)

    console.log(tree.root) // 0
    console.log(tree2.root) // 0n

    {
    tree.add("1", "256") // Hexadecimal key/value.
    console.log("tree.root", tree.root) // [256, 0]
    const proof = tree.createProof("1")
    console.log("proof", proof, proof.siblings.map(s => s.toString()))
    }

    {
    tree.add("6", "78")
    console.log("tree.root", tree.root)
    const proof = tree.createProof("6")
    console.log("proof", proof, proof.siblings.map(s => s.toString()))
    }

    {
    tree.delete("6") // Try 1, too.
    console.log("tree.root", tree.root) // [256, 0]
    const proof = tree.createProof("1")
    console.log("proof", proof, proof.siblings.map(s => s.toString()))
    }

    // tree.add("d", "e7")
    // tree.add("10", "141")
    // tree.add("20", "340")
}

main()