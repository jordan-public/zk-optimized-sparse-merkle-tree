import { checkHex, hexToBin } from "./utils"
import { Key, Hash, HashFunction, Node, ChildNodes, Siblings, Path, MerkleProof } from "./types"

/**
 * Sparse Merkle tree class provides all the functions to create a sparse Merkle tree,
 * add, update and delete entries, create and verify proofs.
 * Characteristics of the Sparse Merkle tree:
 * - It's a binary tree.
 * - All the leaf nodes are at the same depth, which is the depth of the tree.
 * - A leaf contains a hash of the corresponding value. The value itself is not stored, 
 *   as this is not an intended use case. If you need to store the value, you can use
 *   a separate map from the hash to the value.
 * 
 * Optimized hash function:
 * The hash function H used to hash the child nodes is optimized to reduce the number of
 * hashing operations:
 * - An empty leaf is represented as 0.
 * - For any value x, H(x, 0) = H(0, x) = x. Consequently H(0, 0) = 0.
 * 
 * With the above optimization:
 * 1. an empty subtree can be represented as a zero node,
 * 2. a subtree with only one leaf can be represented as the hash of the leaf's value.
 * If the tree is used for non-membership proofs, (1.) occurs in most of the
 * cases. If the tree is used for membership proofs, (2.) occurs in most of
 * the cases.
 * 
 * Data structures:
 * 
 * The data structure used for storing a node is an TypeScript tuple of 2 elements
 * (array of 2 elements in JavaScript). 
 * - If the node is a leaf, the first element is the hash of the value, and the second
 *   element is 0. This makes the node act as a sentinel for the leaf nodes.
 * - If the node is not a leaf, the two elements are the hashes of the child nodes.
 * 
 * The data structure used for storing the nodes in the tree is a key/value map in which:
 * - the key is a node of the tree (yes, an object can be a key in a JavaScript Map, 
 *   and it can be mutated without affecting the mapped value);
 * - if the node is not a leaf, the value is an array of two child nodes. Those nodes
 *   can are either mapped to other child nodes using an entry (key/value) of the tree.
 * - if a node is a leaf node, it is not found in the Map.
 * 
 * How do we know whether a node is a leaf? There are two ways:
 * - If we know the current vertical position of the node in the tree, and it equals
 *   the depth of the tree, then the node is a leaf.
 * - If the node is not found in the Map, then it is a leaf.
 */
export default class SparseMerkleTree {
    private depth: number // The depth of the tree.
    private hash: HashFunction // Hash function used to hash the child nodes.
    private zero: Hash // Value for zero in the appropriate type.
    private bigNumbers: boolean // If `BigInt` or string hash type is used.
    private nodes: Map<Node, ChildNodes> // Non-leaf nodes of the tree.

    // The root node of the tree.
    root: Node

    /**
     * Initializes the SparseMerkleTree attributes.
     * @param hash Hash function used to hash the child nodes.
     * @param bigNumbers BigInt type enabling.
     */
    constructor(hash: HashFunction, depth: number, bigNumbers = false) {
        if (bigNumbers) {
            /* istanbul ignore next */
            if (typeof BigInt !== "function") {
                throw new Error("Big numbers are not supported")
            }

            if (typeof hash(BigInt(1), BigInt(1)) !== "bigint") {
                throw new Error("The hash function must return a big number")
            }
        } else if (!checkHex(hash("1", "1") as string)) {
            throw new Error("The hash function must return a hexadecimal")
        }

        this.depth = depth
        this.bigNumbers = bigNumbers
        this.zero = bigNumbers ? BigInt(0) : "0"
        this.hash = ((H: HashFunction): HashFunction => 
            (x: Hash, y: Hash): Hash => 
                x === this.zero ? y : y === this.zero ? x : H(x, y)
        ) (hash); // We wrap the hash function to optimize it.
        this.nodes = new Map()

        this.root = [this.zero, this.zero] // The root node is initially a zero node.
    }

    /**
     * Gets a key, and if the key exists in the tree,
     * the function returns the value, 
     * otherwise it returns 'undefined'.
     * @param key A key of a tree entry.
     * @returns A value of a tree entry, 0 if not found.
     */
    get(key: Key): Hash {
        this.assertType(key)
        const { valueHash, } = this.retrieve(key)
        return valueHash
    }

    /**
     * Adds a new entry in the tree. Updates all the hashes of the nodes in the path.
     * @param key The key of the new entry.
     * @param value The value of the new entry.
     */
    add(key: Key, valueHash: Hash) {
        if (valueHash === this.zero) throw new Error(`Value hash cannot be zero, which denotes empty subtree`)
        this.update(key, valueHash)
    }

    /**
     * Updates a value of an entry in the tree. Also in this case
     * all the hashes of the nodes in the path of the entry are updated
     * with a bottom-up approach.
     * @param key The key of the entry.
     * @param value The value of the entry.
     */
    update(key: Key, newValueHash: Hash) {
        this.assertType(key)
        this.assertType(newValueHash)

        const { valueHash, siblings } = this.retrieve(key)
        if (valueHash === newValueHash) return // Nothing to update, the value is the same.

        const path = this.keyToPath(key)
        let nodesOnPath : Node[] = [];
        let nodeSought = this.root;
        for (let i = 0; i < path.length; i++) {
            const childNodes = this.nodes.get(nodeSought) as ChildNodes
            if (!childNodes) break
            nodesOnPath.push(nodeSought)
            nodeSought = childNodes[path[i]]
        }
        // Now there are nodesOnPath.length actual nodes on the path, including the root node.
        if (newValueHash === this.zero) { // Removal
            // In this case nodesOnPath.length === path.length === this.depth
            // First remove the bottom of the part that includes empty subtrees (zero nodes)
            if (nodesOnPath.length === path.length)
                throw new Error(`Path to leaf node not equal to tree depth. This is a bug.`)
            for (let i = nodesOnPath.length-1; i >= 0; i--) {
                const sibling = nodesOnPath[i][1-path[i]];
                if (sibling === this.zero) {
                    const removedNode = nodesOnPath.pop() as Node; // Remove empty subtree
                    this.nodes.delete(removedNode);
                    if (this.nodes.size === 0) this.root = [this.zero, this.zero]; // The root overwritten - no reference
                    if (i>0) // The root has no parent
                        nodesOnPath[nodesOnPath.length-1][path[i-1]] = this.zero; // Update parent
                } else break;
            }
            // Now the lowest non-zero node on the path is updated.
            // Now all empty subtrees on the path are removed.
        } else { // newValueHash !== this.zero, so addition
            // Build the subtree from the bottom up
            let newNode = [newValueHash, this.zero] as Node; // Leaf node - not in the map
            for (let i = path.length - 1; i >= nodesOnPath.length; i--) { // Add single child nodes on the bottom
                // Create a node with 1 non-zero child and 1 zero child
                let childNodes = (1-path[i] ? [newNode, [this.zero, this.zero]] : [[this.zero, this.zero], newNode]) as ChildNodes;
                newNode = [this.hash(childNodes[0][0], childNodes[0][1]), this.hash(childNodes[1][0], childNodes[1][1])] as Node;
                this.nodes.set(newNode, childNodes);
                if (i === 0) this.root = newNode; // The root is updated by reference
            }
            // Connect the newly added subtree to the rest of the tree
            if (nodesOnPath.length > 0 ) // The root has no parent
                nodesOnPath[nodesOnPath.length-1][path[nodesOnPath.length-1]] = // Update parent; by reference - the map of Nodes is updated, too
                    this.hash(newNode[0], newNode[1])
            // Now all nodes on the path below nodesOnPath are added.
        }
        // Now all nodes on the path below nodesOnPath are updated.
        // Update all nodes in nodesOnPath, except the lowest one, which was already updated/connected above.
        if (nodesOnPath.length >= 2) // The root has no parent
            for (let i = nodesOnPath.length - 2; i >= 0; i--) { // Update all nodes in nodesOnPath
                const childNodes = this.nodes.get(nodesOnPath[i]) as ChildNodes // Already updated previously by reference
                nodesOnPath[i][path[i]] = this.hash(childNodes[path[i]][0], childNodes[path[i]][1]) // Update node by reference
            }
        // Now all nodes on the path are updated.
        // Now this.root is also updated by reference.
    }

    /**
     * Deletes an entry in the tree. Updates all the hashes of the node appropriately.
     * @param key The key of the entry.
     */
    delete(key: Key) {
        this.update(key, this.zero)
    }

    /**
     * Creates a proof of membership (valueHash is zero) or 
     * the non-membership of a tree entry otherwise.
     * @param key A key of an existing or a non-existing entry.
     * @returns The membership or the non-membership proof.
     */
    createProof(key: Key): MerkleProof {
        this.assertType(key)
        const { valueHash, siblings } = this.retrieve(key)
        const rootHash = this.hash(this.root[0], this.root[1])

        return { valueHash, rootHash, key, siblings }
    }

    /**
     * Verifies a membership or a non-membership proof.
     * @param merkleProof The proof to verify.
     * @returns True if the proof is valid, false otherwise.
     */
    verifyProof(proof: MerkleProof): boolean {
        const path = this.keyToPath(proof.key)
        let nodeHash = proof.valueHash
        for (let i = proof.siblings.length - 1; i >= 0; i -= 1) {
            nodeHash = path[i] ? this.hash(proof.siblings[i], nodeHash) : this.hash(nodeHash, proof.siblings[i])
        }
        return nodeHash === proof.rootHash
    }

    /**
     * Searches for an entry in the tree. 
     * It always returns the sequence of siblings' hashes,
     * even if the entry does not exist, in which case the entry's hash value is zero.
     * @param key The key of the entry to search for.
     * @returns { valueHash, siblings } where valueHash is the hash of the value of the entry sought and sublings is the siblings' hashes list.
     */
    private retrieve(key: Key): { valueHash: Hash, siblings: Hash[] } {
        const path = this.keyToPath(key)
        const siblings: Siblings = []

        // Starts from the root and goes down into the tree until it finds
        // the entry, a zero node or a matching entry.
        let foundZeroNode = false
        let valueHash = this.zero
        for (let i = 0, node = this.root; i < this.depth; i += 1) {
            if (foundZeroNode) siblings.push(this.zero)
            else {
                const childNodes = this.nodes.get(node) as ChildNodes
                if (!childNodes)  {
                    foundZeroNode = true
                    siblings.push(this.zero)
                } else {
                    const siblingHash = node[1-path[i]]
                    siblings.push(siblingHash) // Hash of the sibling of the node.
                    if (i === this.depth - 1) valueHash = node[path[i]] // Hash of the value of the entry.
                }
            }
        }
        return { valueHash, siblings } // Last found hash is the hash of the entry.
    }

    /**
     * Checks if a node is a leaf node.
     * @param node A node of the tree.
     * @returns True if the node is a leaf, false otherwise.
     */
    private isLeaf(node: Node): boolean {
        return !this.nodes.has(node)
    }

    /**
     * Asserts the type of the parameter.
     * @param p The parameter to make sure is correct representation of Hash.
     */
    private assertType(p: Hash | Key) {
        if (this.bigNumbers && typeof p !== "bigint") {
            throw new Error(`Parameter ${p} must be a big number`)
        }

        if (!this.bigNumbers && !checkHex(p as string)) {
            throw new Error(`Parameter ${p} must be a hexadecimal`)
        }
    }

    /**
     * Returns the binary representation of a key. For each key it is possible
     * to obtain an array of 256 padded bits.
     * @param key The key of a tree entry.
     * @returns The relative array of bits.
     */
    private keyToPath(key: Key): Path {
        const bits = typeof key === "bigint" ? key.toString(2) : hexToBin(key as string)

        if (bits.length > this.depth) {
            throw new Error(`The key ${key} is too big for the tree depth ${this.depth}`)
        }

        return bits.padStart(this.depth, "0").split("").map(s => Number(s)===1 ? 1 : 0)
    }

}