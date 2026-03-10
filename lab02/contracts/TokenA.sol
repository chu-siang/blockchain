// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenA is ERC20 {
    constructor() ERC20("Alpha Token", "ALPHA") {
        _mint(msg.sender, 100_000_000 * 10 ** decimals());
    }
}
