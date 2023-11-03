export type Key = string | bigint
export type Hash = string | bigint
export type Node = [Hash, Hash] // Child node hashes
export type ChildNodes = [Node, Node]

export type Siblings = Hash[]

export type HashFunction = (left: Hash, right: Hash) => Hash

export type PathElement = 0 | 1 // 0 = left, 1 = right
export type Path = PathElement[]

export interface MerkleProof {
    valueHash: Hash
    rootHash: Hash
    key: Key
    siblings: Siblings
}