// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MembershipBoard is Ownable {
    mapping(address => bool) public members;
    bytes32 public merkleRoot;

    event MemberAdded(address indexed member);
    event MerkleRootSet(bytes32 indexed root);

    constructor() Ownable(msg.sender) {}

    /// @notice Add a single member (Part 1)
    function addMember(address _member) external onlyOwner {
        require(!members[_member], "Already a member");
        members[_member] = true;
        emit MemberAdded(_member);
    }

    /// @notice Batch add members (Part 2)
    function batchAddMembers(address[] calldata _members) external onlyOwner {
        for (uint256 i = 0; i < _members.length; i++) {
            require(!members[_members[i]], "Already a member");
            members[_members[i]] = true;
            emit MemberAdded(_members[i]);
        }
    }

    /// @notice Set the Merkle root (Part 3)
    function setMerkleRoot(bytes32 _root) external onlyOwner {
        merkleRoot = _root;
        emit MerkleRootSet(_root);
    }

    /// @notice Verify membership via mapping (Part 4)
    function verifyMemberByMapping(address _member) external view returns (bool) {
        return members[_member];
    }

    /// @notice Verify membership via Merkle proof (Part 5)
    function verifyMemberByProof(address _member, bytes32[] calldata _proof) external view returns (bool) {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(_member))));
        return MerkleProof.verify(_proof, merkleRoot, leaf);
    }
}
