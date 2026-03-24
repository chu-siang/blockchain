// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract PermitToken is ERC20 {
    mapping(address => uint256) public nonces;

    constructor() ERC20("Permit Token", "PMIT") {
        _mint(msg.sender, 100_000_000 * 10 ** decimals());
    }

    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) public {
        require(block.timestamp <= deadline, "PermitToken: expired deadline");
        require(nonce == nonces[owner], "PermitToken: invalid nonce");

        bytes32 hash = keccak256(
            abi.encodePacked(
                owner,
                spender,
                value,
                nonce,
                deadline,
                address(this)
            )
        );

        bytes32 message = MessageHashUtils.toEthSignedMessageHash(hash);
        address signer = ECDSA.recover(message, signature);

        require(signer == owner, "PermitToken: invalid signature");

        nonces[owner]++;
        _approve(owner, spender, value);
    }
}
